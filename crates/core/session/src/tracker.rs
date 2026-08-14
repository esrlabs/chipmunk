//! Contains the functionality for adding and tracking all operations running in core
//! including cancelling them as well.

use crate::state::SessionStateAPI;
use log::{debug, error};
use sources::sde::SdeSender;
use std::collections::{HashMap, hash_map::Entry};
use tokio::{
    sync::{
        mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel},
        oneshot,
    },
    time::{Duration, timeout},
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

const CANCEL_OPERATION_TIMEOUT: u64 = 3000;

pub enum TrackerCommand {
    AddOperation(
        (
            Uuid,
            Option<SdeSender>,
            CancellationToken,
            CancellationToken,
            oneshot::Sender<bool>,
        ),
    ),
    RemoveOperation((Uuid, oneshot::Sender<bool>)),
    CancelOperation((Uuid, oneshot::Sender<bool>)),
    GetSdeSender((Uuid, oneshot::Sender<Option<SdeSender>>)),
    CancelAll(oneshot::Sender<()>),
    Shutdown,
}

impl std::fmt::Display for TrackerCommand {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Self::AddOperation(_) => "AddOperation",
                Self::RemoveOperation(_) => "RemoveOperation",
                Self::CancelOperation(_) => "CancelOperation",
                Self::GetSdeSender(_) => "GetSdeSender",
                Self::CancelAll(_) => "CancelAll",
                Self::Shutdown => "Shutdown",
            }
        )
    }
}

/// Cancellation and data-exchange handles of one running operation.
#[derive(Debug)]
struct TrackedOperation {
    sde_tx: Option<SdeSender>,
    canceler: CancellationToken,
    done: CancellationToken,
}

#[derive(Clone, Debug)]
pub struct OperationTrackerAPI {
    tx_api: UnboundedSender<TrackerCommand>,
}

impl OperationTrackerAPI {
    pub fn new() -> (Self, UnboundedReceiver<TrackerCommand>) {
        let (tx_api, rx_api) = unbounded_channel();
        (OperationTrackerAPI { tx_api }, rx_api)
    }

    async fn exec_operation<T>(
        &self,
        command: TrackerCommand,
        rx_response: oneshot::Receiver<T>,
    ) -> Result<T, stypes::NativeError> {
        let api_str = format!("{command}");
        self.tx_api.send(command).map_err(|e| {
            stypes::NativeError::channel(&format!("Failed to send to Api::{api_str}; error: {e}"))
        })?;
        rx_response.await.map_err(|_| {
            stypes::NativeError::channel(&format!("Failed to get response from Api::{api_str}"))
        })
    }

    pub async fn add_operation(
        &self,
        uuid: Uuid,
        tx_sde: Option<SdeSender>,
        canceler: CancellationToken,
        done: CancellationToken,
    ) -> Result<bool, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(
            TrackerCommand::AddOperation((uuid, tx_sde, canceler, done, tx)),
            rx,
        )
        .await
    }

    pub async fn remove_operation(&self, uuid: Uuid) -> Result<bool, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(TrackerCommand::RemoveOperation((uuid, tx)), rx)
            .await
    }

    pub async fn cancel_operation(&self, uuid: Uuid) -> Result<bool, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(TrackerCommand::CancelOperation((uuid, tx)), rx)
            .await
    }

    pub async fn cancel_all(&self) -> Result<(), stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(TrackerCommand::CancelAll(tx), rx).await
    }

    pub async fn get_sde_sender(
        &self,
        uuid: Uuid,
    ) -> Result<Option<SdeSender>, stypes::NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(TrackerCommand::GetSdeSender((uuid, tx)), rx)
            .await
    }

    pub fn shutdown(&self) -> Result<(), stypes::NativeError> {
        self.tx_api.send(TrackerCommand::Shutdown).map_err(|e| {
            stypes::NativeError::channel(&format!("fail to send to Api::Shutdown; error: {e}",))
        })
    }
}

pub async fn run(
    state: SessionStateAPI,
    mut rx_api: UnboundedReceiver<TrackerCommand>,
) -> Result<(), stypes::NativeError> {
    let mut operations: HashMap<Uuid, TrackedOperation> = HashMap::new();
    debug!("task is started");
    while let Some(msg) = rx_api.recv().await {
        match msg {
            TrackerCommand::AddOperation((uuid, sde_tx, canceler, done, tx_response)) => {
                if tx_response
                    .send(match operations.entry(uuid) {
                        Entry::Vacant(entry) => {
                            entry.insert(TrackedOperation {
                                sde_tx,
                                canceler,
                                done,
                            });
                            true
                        }
                        _ => false,
                    })
                    .is_err()
                {
                    return Err(stypes::NativeError::channel(
                        "fail to response to Api::AddOperation",
                    ));
                }
            }
            TrackerCommand::RemoveOperation((uuid, tx_response)) => {
                if let Err(err) = state.canceled_operation(uuid).await {
                    error!("fail to notify state about canceled operation {uuid}; err: {err:?}");
                }
                if tx_response
                    .send(operations.remove(&uuid).is_some())
                    .is_err()
                {
                    return Err(stypes::NativeError::channel(
                        "fail to response to Api::RemoveOperation",
                    ));
                }
            }
            TrackerCommand::CancelOperation((uuid, tx_response)) => {
                if let Err(err) = state.canceling_operation(uuid).await {
                    error!(
                        "Failed to notify state about cancelation operation {uuid}; err: {err:?}"
                    );
                }
                tx_response
                    .send(if let Some(operation) = operations.remove(&uuid) {
                        if !operation.done.is_cancelled() {
                            operation.canceler.cancel();
                            debug!("Waiting for operation {uuid} would confirm done-state");
                            operation.done.cancelled().await;
                        }
                        if let Err(err) = state.canceled_operation(uuid).await {
                            error!(
                                "Failed to notify state about canceled operation {uuid}; err: {err:?}"
                            );
                        }
                        true
                    } else {
                        false
                    })
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::CancelOperation")
                    })?;
            }
            TrackerCommand::CancelAll(tx_response) => {
                for (uuid, operation) in &operations {
                    if !operation.done.is_cancelled() {
                        operation.canceler.cancel();
                        debug!("waiting for operation {uuid} would confirm done-state");
                        if timeout(
                            Duration::from_millis(CANCEL_OPERATION_TIMEOUT),
                            operation.done.cancelled(),
                        )
                        .await
                        .is_err()
                        {
                            error!(
                                "timeout {}s to stop opearation {uuid}",
                                CANCEL_OPERATION_TIMEOUT / 1000
                            );
                        }
                    }
                }
                operations.clear();
                if tx_response.send(()).is_err() {
                    return Err(stypes::NativeError::channel(
                        "fail to response to Api::CloseSession",
                    ));
                }
            }
            TrackerCommand::GetSdeSender((uuid, tx_response)) => {
                if tx_response
                    .send(operations.get(&uuid).and_then(|op| op.sde_tx.clone()))
                    .is_err()
                {
                    return Err(stypes::NativeError::channel(
                        "fail to response to Api::GetSdeSender",
                    ));
                }
            }
            TrackerCommand::Shutdown => {
                debug!("shutdown has been requested");
                break;
            }
        }
    }
    debug!("task is finished");
    Ok(())
}
