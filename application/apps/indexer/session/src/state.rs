use crate::{
    events::{NativeError, NativeErrorKind},
    operations::OperationStat,
};
use indexer_base::progress::Severity;
use log::{debug, error};
use processor::{
    grabber::GrabMetadata,
    map::{FilterMatch, SearchMap},
};
use std::collections::{hash_map::Entry, HashMap};
use tokio::{
    select,
    sync::{
        mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot,
    },
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub enum Api {
    GetSearchMap(oneshot::Sender<SearchMap>),
    SetMetadata((Option<GrabMetadata>, oneshot::Sender<()>)),
    ExtractMetadata(oneshot::Sender<Option<GrabMetadata>>),
    SetStreamLen((u64, oneshot::Sender<()>)),
    SetMatches((Option<Vec<FilterMatch>>, oneshot::Sender<()>)),
    AddOperation((Uuid, String, CancellationToken, oneshot::Sender<bool>)),
    RemoveOperation((Uuid, oneshot::Sender<bool>)),
    CancelOperation((Uuid, oneshot::Sender<bool>)),
    CloseSession(oneshot::Sender<()>),
    SetDebugMode((bool, oneshot::Sender<()>)),
    GetOperationsStat(oneshot::Sender<Result<String, NativeError>>),
    Shutdown,
}

#[derive(Debug)]
pub enum Status {
    Open,
    Closed,
}

#[derive(Debug)]
pub struct SessionState {
    pub assigned_file: Option<String>,
    pub search_map: SearchMap,
    pub metadata: Option<GrabMetadata>,
    pub operations: HashMap<Uuid, CancellationToken>,
    pub status: Status,
    pub stat: Vec<OperationStat>,
    pub debug: bool,
}

#[derive(Clone, Debug)]
pub struct SessionStateAPI {
    tx_api: UnboundedSender<Api>,
    shutdown: CancellationToken,
}

impl SessionStateAPI {
    pub fn new() -> (Self, UnboundedReceiver<Api>) {
        let (tx_api, rx_api): (UnboundedSender<Api>, UnboundedReceiver<Api>) = unbounded_channel();
        (
            SessionStateAPI {
                tx_api,
                shutdown: CancellationToken::new(),
            },
            rx_api,
        )
    }

    pub async fn get_search_map(&self) -> Result<SearchMap, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<SearchMap>, oneshot::Receiver<SearchMap>) =
            oneshot::channel();
        self.tx_api
            .send(Api::GetSearchMap(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::GetSearchMap; error: {}", e,)),
            })?;
        Ok(rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::GetSearchMap")),
        })?)
    }

    pub async fn set_metadata(&self, meta: Option<GrabMetadata>) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(Api::SetMetadata((meta, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::SetMetadata; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::SetMetadata")),
        })?;
        Ok(())
    }

    pub async fn extract_metadata(&self) -> Result<Option<GrabMetadata>, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Option<GrabMetadata>>,
            oneshot::Receiver<Option<GrabMetadata>>,
        ) = oneshot::channel();
        self.tx_api
            .send(Api::ExtractMetadata(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to send to Api::ExtractMetadata; error: {}",
                    e,
                )),
            })?;
        Ok(rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from Api::ExtractMetadata",
            )),
        })?)
    }

    pub async fn set_stream_len(&self, len: u64) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(Api::SetStreamLen((len, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::SetStreamLen; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::SetStreamLen")),
        })?;
        Ok(())
    }

    pub async fn set_matches(&self, matches: Option<Vec<FilterMatch>>) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(Api::SetMatches((matches, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::SetMatches; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::SetMatches")),
        })?;
        Ok(())
    }

    pub async fn add_operation(
        &self,
        uuid: Uuid,
        name: String,
        canceler: CancellationToken,
    ) -> Result<bool, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<bool>, oneshot::Receiver<bool>) =
            oneshot::channel();
        self.tx_api
            .send(Api::AddOperation((uuid, name, canceler, tx_response)))
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

    pub async fn close_session(&self) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(Api::CloseSession(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::CloseSession; error: {}", e,)),
            })?;
        Ok(rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::CloseSession")),
        })?)
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

    pub fn is_shutdown(&self) -> bool {
        self.shutdown.is_cancelled()
    }

    pub fn get_shutdown_token(&self) -> CancellationToken {
        self.shutdown.clone()
    }
}

pub async fn task(
    mut rx_api: UnboundedReceiver<Api>,
    shutdown: CancellationToken,
) -> Result<(), NativeError> {
    let mut state = SessionState {
        assigned_file: None,
        search_map: SearchMap::new(),
        metadata: None,
        operations: HashMap::new(),
        status: Status::Open,
        stat: vec![],
        debug: false,
    };
    let shutdown_caller = shutdown.clone();
    debug!("task is started");
    select! {
        _ = async move {
            while let Some(msg) = rx_api.recv().await {
                match msg {
                    Api::GetSearchMap(rx_response) => {
                        if rx_response.send(state.search_map.clone()).is_err() {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(String::from("fail to response to Api::GetSearchMap")),
                            });
                        }
                    }
                    Api::SetMetadata((metadata, rx_response)) => {
                        state.metadata = metadata;
                        if rx_response.send(()).is_err() {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(String::from("fail to response to Api::SetMetadata")),
                            });
                        }
                    }
                    Api::ExtractMetadata(rx_response) => {
                        if rx_response.send(state.metadata.take()).is_err() {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(String::from("fail to response to Api::ExtractMetadata")),
                            });
                        }
                    }
                    Api::SetStreamLen((len, rx_response)) => {
                        state.search_map.set_stream_len(len);
                        if rx_response.send(()).is_err() {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(String::from("fail to response to Api::SetStreamLen")),
                            });
                        }
                    }
                    Api::SetMatches((matches, rx_response)) => {
                        state.search_map.set(matches);
                        if rx_response.send(()).is_err() {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(String::from("fail to response to Api::SetMatches")),
                            });
                        }
                    }
                    Api::AddOperation((uuid, name, token, rx_response)) => {
                        if state.debug {
                            state.stat.push(OperationStat::new(uuid.to_string(), name));
                        }
                        if rx_response
                            .send(match state.operations.entry(uuid) {
                                Entry::Vacant(entry) => {
                                    entry.insert(token);
                                    true
                                },
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
                    Api::RemoveOperation((uuid, rx_response)) => {
                        if state.debug {
                            let str_uuid = uuid.to_string();
                            if let Some(index) = state.stat.iter().position(|op| op.uuid == str_uuid) {
                                state.stat[index].done();
                            } else {
                                error!("fail to find operation in stat: {}", str_uuid);
                            }
                        }
                        if rx_response
                            .send(state.operations.remove(&uuid).is_some())
                            .is_err()
                        {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(String::from("fail to response to Api::RemoveOperation")),
                            });
                        }
                    }
                    Api::CancelOperation((uuid, rx_response)) => {
                        if rx_response
                            .send(if let Some(token) = state.operations.remove(&uuid) {
                                token.cancel();
                                true
                            } else {
                                false
                            })
                            .is_err()
                        {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(String::from("fail to response to Api::CancelOperation")),
                            });
                        }
                    }
                    Api::CloseSession(rx_response) => {
                        state.status = Status::Closed;
                        for token in state.operations.values() {
                            token.cancel();
                        }
                        state.operations.clear();
                        if rx_response.send(()).is_err() {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(String::from("fail to response to Api::CloseSession")),
                            });
                        }
                    }
                    Api::SetDebugMode((debug, rx_response)) => {
                        state.debug = debug;
                        if rx_response
                            .send(())
                            .is_err()
                        {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(String::from("fail to response to Api::SetDebugMode")),
                            });
                        }
                    }
                    Api::GetOperationsStat(rx_response) => {
                        if rx_response
                            .send(match serde_json::to_string(&state.stat) {
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
                        shutdown_caller.cancel();
                    }
                }
            }
            Ok(())
        } => {},
        _ = shutdown.cancelled() => {}
    };
    debug!("task is finished");
    Ok(())
}
