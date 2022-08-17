use crate::{
    events::{NativeError, NativeErrorKind},
    operations::OperationStat,
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

pub enum Api {
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

impl std::fmt::Display for Api {
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
    tx_api: UnboundedSender<Api>,
}

#[allow(clippy::type_complexity)]
impl OperationTrackerAPI {
    pub fn new() -> (Self, UnboundedReceiver<Api>) {
        let (tx_api, rx_api): (UnboundedSender<Api>, UnboundedReceiver<Api>) = unbounded_channel();
        (OperationTrackerAPI { tx_api }, rx_api)
    }

    async fn exec_operation<T>(
        &self,
        api: Api,
        rx_response: oneshot::Receiver<T>,
    ) -> Result<T, NativeError> {
        let api_str = format!("{}", api);
        self.tx_api.send(api).map_err(|e| {
            NativeError::channel(&format!("Failed to send to Api::{}; error: {}", api_str, e))
        })?;
        rx_response.await.map_err(|_| {
            NativeError::channel(&format!("Failed to get response from Api::{}", api_str))
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
            Api::AddOperation((uuid, name, tx_sde, canceler, done, tx)),
            rx,
        )
        .await
    }

    pub async fn remove_operation(&self, uuid: Uuid) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::RemoveOperation((uuid, tx)), rx)
            .await
    }

    pub async fn cancel_operation(&self, uuid: Uuid) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::CancelOperation((uuid, tx)), rx)
            .await
    }

    pub async fn cancel_all(&self) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::CancelAll(tx), rx).await
    }

    pub async fn set_debug(&self, debug: bool) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetDebugMode((debug, tx)), rx)
            .await?;
        Ok(())
    }

    pub async fn get_operations_stat(&self) -> Result<String, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetOperationsStat(tx), rx).await?
    }

    pub async fn get_sde_sender(&self, uuid: Uuid) -> Result<Option<SdeSender>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSdeSender((uuid, tx)), rx).await
    }

    pub fn shutdown(&self) -> Result<(), NativeError> {
        self.tx_api.send(Api::Shutdown).map_err(|e| {
            NativeError::channel(&format!("fail to send to Api::Shutdown; error: {}", e,))
        })
    }
}

pub async fn run(
    state: SessionStateAPI,
    mut rx_api: UnboundedReceiver<Api>,
) -> Result<(), NativeError> {
    let mut tracker = OperationTracker {
        operations: HashMap::new(),
        stat: vec![],
        debug: false,
    };
    debug!("task is started");
    while let Some(msg) = rx_api.recv().await {
        match msg {
            Api::AddOperation((uuid, name, tx_sde, cancalation_token, done_token, tx_response)) => {
                if tracker.debug {
                    tracker
                        .stat
                        .push(OperationStat::new(uuid.to_string(), name));
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
                }
            }
            Api::RemoveOperation((uuid, tx_response)) => {
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
                if tx_response
                    .send(tracker.operations.remove(&uuid).is_some())
                    .is_err()
                {
                    return Err(NativeError::channel(
                        "fail to response to Api::RemoveOperation",
                    ));
                }
            }
            Api::CancelOperation((uuid, tx_response)) => {
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
            Api::CancelAll(tx_response) => {
                for (uuid, (_tx_sde, operation_cancalation_token, done_token)) in
                    &tracker.operations
                {
                    if !done_token.is_cancelled() {
                        operation_cancalation_token.cancel();
                        debug!("waiting for operation {} would confirm done-state", uuid);
                        // TODO: add timeout to preven situation with waiting forever. 2-3 sec.
                        done_token.cancelled().await;
                    }
                }
                tracker.operations.clear();
                if tx_response.send(()).is_err() {
                    return Err(NativeError::channel(
                        "fail to response to Api::CloseSession",
                    ));
                }
            }
            Api::SetDebugMode((debug, tx_response)) => {
                tracker.debug = debug;
                if tx_response.send(()).is_err() {
                    return Err(NativeError::channel(
                        "fail to response to Api::SetDebugMode",
                    ));
                }
            }
            Api::GetOperationsStat(tx_response) => {
                if tx_response
                    .send(match serde_json::to_string(&tracker.stat) {
                        Ok(serialized) => Ok(serialized),
                        Err(err) => Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::ComputationFailed,
                            message: Some(format!("{}", err)),
                        }),
                    })
                    .is_err()
                {
                    return Err(NativeError::channel(
                        "fail to response to Api::GetOperationsStat",
                    ));
                }
            }
            Api::GetSdeSender((uuid, tx_response)) => {
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
            Api::Shutdown => {
                debug!("shutdown has been requested");
                break;
            }
        }
    }
    debug!("task is finished");
    Ok(())
}
