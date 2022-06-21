use crate::{
    events::{NativeError, NativeErrorKind},
    operations::OperationStat,
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use log::{debug, error};

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
            CancellationToken,
            CancellationToken,
            oneshot::Sender<bool>,
        ),
    ),
    RemoveOperation((Uuid, oneshot::Sender<bool>)),
    CancelOperation((Uuid, oneshot::Sender<bool>)),
    SetDebugMode((bool, oneshot::Sender<()>)),
    GetOperationsStat(oneshot::Sender<Result<String, NativeError>>),
    CancelAll(oneshot::Sender<()>),
    Shutdown,
}

#[derive(Debug)]
pub struct OperationTracker {
    pub operations: HashMap<Uuid, (CancellationToken, CancellationToken)>,
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

    pub async fn add_operation(
        &self,
        uuid: Uuid,
        name: String,
        canceler: CancellationToken,
        done: CancellationToken,
    ) -> Result<bool, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<bool>, oneshot::Receiver<bool>) =
            oneshot::channel();
        self.tx_api
            .send(Api::AddOperation((uuid, name, canceler, done, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::AddOperation; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::AddOperation")),
        })
    }

    pub async fn remove_operation(&self, uuid: Uuid) -> Result<bool, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<bool>, oneshot::Receiver<bool>) =
            oneshot::channel();
        self.tx_api
            .send(Api::RemoveOperation((uuid, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to send to Api::RemoveOperation; error: {}",
                    e,
                )),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from Api::RemoveOperation",
            )),
        })
    }

    pub async fn cancel_operation(&self, uuid: Uuid) -> Result<bool, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<bool>, oneshot::Receiver<bool>) =
            oneshot::channel();
        self.tx_api
            .send(Api::CancelOperation((uuid, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to send to Api::CancelOperation; error: {}",
                    e,
                )),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from Api::CancelOperation",
            )),
        })
    }

    pub async fn cancel_all(&self) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(Api::CancelAll(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::CancelAll; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::CancelAll")),
        })
    }

    pub async fn set_debug(&self, debug: bool) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(Api::SetDebugMode((debug, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::SetDebugMode; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::SetDebugMode")),
        })?;
        Ok(())
    }

    pub async fn get_operations_stat(&self) -> Result<String, NativeError> {
        let (tx_response, rx_response) = oneshot::channel();
        self.tx_api
            .send(Api::GetOperationsStat(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to send to Api::GetOperationsStat; error: {}",
                    e,
                )),
            })?;
        match rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from Api::GetOperationsStat",
            )),
        }) {
            Ok(result) => result,
            Err(err) => Err(err),
        }
    }

    pub fn shutdown(&self) -> Result<(), NativeError> {
        self.tx_api.send(Api::Shutdown).map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(format!("fail to send to Api::Shutdown; error: {}", e,)),
        })
    }
}

pub async fn task(
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
            Api::AddOperation((uuid, name, cancalation_token, done_token, tx_response)) => {
                if tracker.debug {
                    tracker
                        .stat
                        .push(OperationStat::new(uuid.to_string(), name));
                }
                if tx_response
                    .send(match tracker.operations.entry(uuid) {
                        Entry::Vacant(entry) => {
                            entry.insert((cancalation_token, done_token));
                            true
                        }
                        _ => false,
                    })
                    .is_err()
                {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::AddOperation")),
                    });
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
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::RemoveOperation")),
                    });
                }
            }
            Api::CancelOperation((uuid, tx_response)) => {
                if let Err(err) = state.canceling_operation(uuid).await {
                    error!(
                        "fail to notify state about cancelation operation {}; err: {:?}",
                        uuid, err
                    );
                }
                if tx_response
                    .send(
                        if let Some((operation_cancalation_token, done_token)) =
                            tracker.operations.remove(&uuid)
                        {
                            if !done_token.is_cancelled() {
                                operation_cancalation_token.cancel();
                                debug!("waiting for operation {} would confirm done-state", uuid);
                                done_token.cancelled().await;
                            }
                            if let Err(err) = state.canceled_operation(uuid).await {
                                error!(
                                    "fail to notify state about canceled operation {}; err: {:?}",
                                    uuid, err
                                );
                            }
                            true
                        } else {
                            false
                        },
                    )
                    .is_err()
                {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::CancelOperation")),
                    });
                }
            }
            Api::CancelAll(tx_response) => {
                for (uuid, (operation_cancalation_token, done_token)) in &tracker.operations {
                    if !done_token.is_cancelled() {
                        operation_cancalation_token.cancel();
                        debug!("waiting for operation {} would confirm done-state", uuid);
                        // TODO: add timeout to preven situation with waiting forever. 2-3 sec.
                        done_token.cancelled().await;
                    }
                }
                tracker.operations.clear();
                if tx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::CloseSession")),
                    });
                }
            }
            Api::SetDebugMode((debug, tx_response)) => {
                tracker.debug = debug;
                if tx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::SetDebugMode")),
                    });
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
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::GetOperationsStat")),
                    });
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
