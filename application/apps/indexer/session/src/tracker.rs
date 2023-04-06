use crate::{
    events::{NativeError, NativeErrorKind},
    operations::OperationStat,
    progress::ProgressProviderAPI,
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use log::{debug, error};
use sources::producer::SdeSender;
use std::collections::{hash_map::Entry, HashMap};
use tokio::sync::{
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    oneshot,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub enum TrackerCommand {
    AddOperation(
        (
            Uuid,
            String,
            Option<SdeSender>,
            CancellationToken,
            CancellationToken,
            oneshot::Sender<bool>,
        ),
    ),
    RemoveOperation((Uuid, oneshot::Sender<bool>)),
    CancelOperation((Uuid, oneshot::Sender<bool>)),
    SetDebugMode((bool, oneshot::Sender<()>)),
    GetOperationsStat(oneshot::Sender<Result<String, NativeError>>),
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
                Self::SetDebugMode(_) => "SetDebugMode",
                Self::GetOperationsStat(_) => "GetOperationsStat",
                Self::GetSdeSender(_) => "GetSdeSender",
                Self::CancelAll(_) => "CancelAll",
                Self::Shutdown => "Shutdown",
            }
        )
    }
}

#[derive(Debug)]
pub struct OperationTracker {
    pub operations: HashMap<Uuid, (Option<SdeSender>, CancellationToken, CancellationToken)>,
    pub stat: Vec<OperationStat>,
    pub debug: bool,
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
    ) -> Result<T, NativeError> {
        let api_str = format!("{command}");
        self.tx_api.send(command).map_err(|e| {
            NativeError::channel(&format!("Failed to send to Api::{api_str}; error: {e}"))
        })?;
        rx_response.await.map_err(|_| {
            NativeError::channel(&format!("Failed to get response from Api::{api_str}"))
        })
    }

    pub async fn add_operation(
        &self,
        uuid: Uuid,
        name: String,
        tx_sde: Option<SdeSender>,
        canceler: CancellationToken,
        done: CancellationToken,
    ) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(
            TrackerCommand::AddOperation((uuid, name, tx_sde, canceler, done, tx)),
            rx,
        )
        .await
    }

    pub async fn remove_operation(&self, uuid: Uuid) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(TrackerCommand::RemoveOperation((uuid, tx)), rx)
            .await
    }

    pub async fn cancel_operation(&self, uuid: Uuid) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(TrackerCommand::CancelOperation((uuid, tx)), rx)
            .await
    }

    pub async fn cancel_all(&self) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(TrackerCommand::CancelAll(tx), rx).await
    }

    pub async fn set_debug(&self, debug: bool) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(TrackerCommand::SetDebugMode((debug, tx)), rx)
            .await?;
        Ok(())
    }

    pub async fn get_operations_stat(&self) -> Result<String, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(TrackerCommand::GetOperationsStat(tx), rx)
            .await?
    }

    pub async fn get_sde_sender(&self, uuid: Uuid) -> Result<Option<SdeSender>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(TrackerCommand::GetSdeSender((uuid, tx)), rx)
            .await
    }

    pub fn shutdown(&self) -> Result<(), NativeError> {
        self.tx_api.send(TrackerCommand::Shutdown).map_err(|e| {
            NativeError::channel(&format!("fail to send to Api::Shutdown; error: {e}",))
        })
    }
}

pub async fn run(
    state: SessionStateAPI,
    mut rx_api: UnboundedReceiver<TrackerCommand>,
) -> Result<(), NativeError> {
    let mut tracker = OperationTracker {
        operations: HashMap::new(),
        stat: vec![],
        debug: false,
    };
    let progress = ProgressProviderAPI::new()?;
    debug!("task is started");
    while let Some(msg) = rx_api.recv().await {
        match msg {
            TrackerCommand::AddOperation((
                uuid,
                name,
                tx_sde,
                cancalation_token,
                done_token,
                tx_response,
            )) => {
                if tracker.debug {
                    tracker
                        .stat
                        .push(OperationStat::new(uuid.to_string(), name.clone()));
                }
                if tx_response
                    .send(match tracker.operations.entry(uuid) {
                        Entry::Vacant(entry) => {
                            entry.insert((tx_sde, cancalation_token, done_token));
                            true
                        }
                        _ => false,
                    })
                    .is_err()
                {
                    return Err(NativeError::channel(
                        "fail to response to Api::AddOperation",
                    ));
                } else {
                    progress.started(&name, &uuid);
                }
            }
            TrackerCommand::RemoveOperation((uuid, tx_response)) => {
                if let Err(err) = state.canceled_operation(uuid).await {
                    error!(
                        "fail to notify state about canceled operation {}; err: {:?}",
                        uuid, err
                    );
                }
                if tracker.debug {
                    let str_uuid = uuid.to_string();
                    if let Some(index) = tracker.stat.iter().position(|op| op.uuid == str_uuid) {
                        tracker.stat[index].done();
                    } else {
                        error!("fail to find operation in stat: {}", str_uuid);
                    }
                }
                progress.stopped(&uuid);
                if tx_response
                    .send(tracker.operations.remove(&uuid).is_some())
                    .is_err()
                {
                    return Err(NativeError::channel(
                        "fail to response to Api::RemoveOperation",
                    ));
                }
            }
            TrackerCommand::CancelOperation((uuid, tx_response)) => {
                if let Err(err) = state.canceling_operation(uuid).await {
                    error!(
                        "Failed to notify state about cancelation operation {}; err: {:?}",
                        uuid, err
                    );
                }
                tx_response
                    .send(
                        if let Some((_tx_sde, operation_cancalation_token, done_token)) =
                            tracker.operations.remove(&uuid)
                        {
                            if !done_token.is_cancelled() {
                                operation_cancalation_token.cancel();
                                debug!("Waiting for operation {} would confirm done-state", uuid);
                                done_token.cancelled().await;
                                progress.stopped(&uuid);
                            }
                            if let Err(err) = state.canceled_operation(uuid).await {
                                error!(
                                    "Failed to notify state about canceled operation {}; err: {:?}",
                                    uuid, err
                                );
                            }
                            true
                        } else {
                            false
                        },
                    )
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::CancelOperation")
                    })?;
            }
            TrackerCommand::CancelAll(tx_response) => {
                for (uuid, (_tx_sde, operation_cancalation_token, done_token)) in
                    &tracker.operations
                {
                    if !done_token.is_cancelled() {
                        operation_cancalation_token.cancel();
                        debug!("waiting for operation {} would confirm done-state", uuid);
                        // TODO: add timeout to preven situation with waiting forever. 2-3 sec.
                        done_token.cancelled().await;
                        progress.stopped(uuid);
                    }
                }
                tracker.operations.clear();
                if tx_response.send(()).is_err() {
                    return Err(NativeError::channel(
                        "fail to response to Api::CloseSession",
                    ));
                }
            }
            TrackerCommand::SetDebugMode((debug, tx_response)) => {
                tracker.debug = debug;
                if tx_response.send(()).is_err() {
                    return Err(NativeError::channel(
                        "fail to response to Api::SetDebugMode",
                    ));
                }
            }
            TrackerCommand::GetOperationsStat(tx_response) => {
                if tx_response
                    .send(match serde_json::to_string(&tracker.stat) {
                        Ok(serialized) => Ok(serialized),
                        Err(err) => Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::ComputationFailed,
                            message: Some(format!("{err}")),
                        }),
                    })
                    .is_err()
                {
                    return Err(NativeError::channel(
                        "fail to response to Api::GetOperationsStat",
                    ));
                }
            }
            TrackerCommand::GetSdeSender((uuid, tx_response)) => {
                if tx_response
                    .send(
                        if let Some((tx_sde, _, _)) = tracker.operations.get(&uuid) {
                            tx_sde.clone()
                        } else {
                            None
                        },
                    )
                    .is_err()
                {
                    return Err(NativeError::channel(
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
