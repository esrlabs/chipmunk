use crate::{
    js::session::events::{NativeError, NativeErrorKind},
    logging::targets,
};
use indexer_base::progress::Severity;
use log::debug;
use processor::{
    grabber::GrabMetadata,
    map::{FilterMatch, SearchMap},
    search::SearchFilter,
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
    // SetAssignedFile((Option<String>, oneshot::Sender<()>)),
    // GetAssignedFile(oneshot::Sender<Option<String>>),
    // SetFilters((Vec<SearchFilter>, oneshot::Sender<()>)),
    // GetFilters(oneshot::Sender<Vec<SearchFilter>>),
    // SetSearchMap((SearchMap, oneshot::Sender<()>)),
    GetSearchMap(oneshot::Sender<SearchMap>),
    SetMetadata((Option<GrabMetadata>, oneshot::Sender<()>)),
    GetMetadata(oneshot::Sender<Option<GrabMetadata>>),
    ExtractMetadata(oneshot::Sender<Option<GrabMetadata>>),
    SetStreamLen((u64, oneshot::Sender<()>)),
    SetMatches((Option<Vec<FilterMatch>>, oneshot::Sender<()>)),
    AddOperation((Uuid, CancellationToken, oneshot::Sender<bool>)),
    RemoveOperation((Uuid, oneshot::Sender<bool>)),
    CancelOperation((Uuid, oneshot::Sender<bool>)),
    CloseSession(oneshot::Sender<()>),
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
    pub filters: Vec<SearchFilter>,
    pub search_map: SearchMap,
    pub metadata: Option<GrabMetadata>,
    pub operations: HashMap<Uuid, CancellationToken>,
    pub status: Status,
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
    // pub async fn set_assigned_file(&self, file: Option<String>) -> Result<(), NativeError> {
    //     let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
    //         oneshot::channel();
    //     self.tx_api
    //         .send(Api::SetAssignedFile((file, tx_response)))
    //         .map_err(|e| NativeError {
    //             severity: Severity::ERROR,
    //             kind: NativeErrorKind::ChannelError,
    //             message: Some(format!(
    //                 "fail to send to Api::SetAssignedFile; error: {}",
    //                 e,
    //             )),
    //         })?;
    //     rx_response.await.map_err(|e| NativeError {
    //         severity: Severity::ERROR,
    //         kind: NativeErrorKind::ChannelError,
    //         message: Some(String::from(
    //             "fail to get response from Api::SetAssignedFile",
    //         )),
    //     })?;
    //     Ok(())
    // }
    // pub async fn get_assigned_file(&self) -> Result<Option<String>, NativeError> {
    //     let (tx_response, rx_response): (
    //         oneshot::Sender<Option<String>>,
    //         oneshot::Receiver<Option<String>>,
    //     ) = oneshot::channel();
    //     self.tx_api
    //         .send(Api::GetAssignedFile(tx_response))
    //         .map_err(|e| NativeError {
    //             severity: Severity::ERROR,
    //             kind: NativeErrorKind::ChannelError,
    //             message: Some(format!(
    //                 "fail to send to Api::GetAssignedFile; error: {}",
    //                 e,
    //             )),
    //         })?;
    //     Ok(rx_response.await.map_err(|e| NativeError {
    //         severity: Severity::ERROR,
    //         kind: NativeErrorKind::ChannelError,
    //         message: Some(String::from(
    //             "fail to get response from Api::GetAssignedFile",
    //         )),
    //     })?)
    // }
    // pub async fn set_filters(&self, filters: Vec<SearchFilter>) -> Result<(), NativeError> {
    //     let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
    //         oneshot::channel();
    //     self.tx_api
    //         .send(Api::SetFilters((filters, tx_response)))
    //         .map_err(|e| NativeError {
    //             severity: Severity::ERROR,
    //             kind: NativeErrorKind::ChannelError,
    //             message: Some(format!("fail to send to Api::SetFilters; error: {}", e,)),
    //         })?;
    //     rx_response.await.map_err(|e| NativeError {
    //         severity: Severity::ERROR,
    //         kind: NativeErrorKind::ChannelError,
    //         message: Some(String::from("fail to get response from Api::SetFilters")),
    //     })?;
    //     Ok(())
    // }
    // pub async fn get_filters(&self) -> Result<Vec<SearchFilter>, NativeError> {
    //     let (tx_response, rx_response): (
    //         oneshot::Sender<Vec<SearchFilter>>,
    //         oneshot::Receiver<Vec<SearchFilter>>,
    //     ) = oneshot::channel();
    //     self.tx_api
    //         .send(Api::GetFilters(tx_response))
    //         .map_err(|e| NativeError {
    //             severity: Severity::ERROR,
    //             kind: NativeErrorKind::ChannelError,
    //             message: Some(format!("fail to send to Api::GetFilters; error: {}", e,)),
    //         })?;
    //     Ok(rx_response.await.map_err(|e| NativeError {
    //         severity: Severity::ERROR,
    //         kind: NativeErrorKind::ChannelError,
    //         message: Some(String::from("fail to get response from Api::GetFilters")),
    //     })?)
    // }
    // pub async fn set_search_map(&self, map: SearchMap) -> Result<(), NativeError> {
    //     let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
    //         oneshot::channel();
    //     self.tx_api
    //         .send(Api::SetSearchMap((map, tx_response)))
    //         .map_err(|e| NativeError {
    //             severity: Severity::ERROR,
    //             kind: NativeErrorKind::ChannelError,
    //             message: Some(format!("fail to send to Api::SetSearchMap; error: {}", e,)),
    //         })?;
    //     rx_response.await.map_err(|e| NativeError {
    //         severity: Severity::ERROR,
    //         kind: NativeErrorKind::ChannelError,
    //         message: Some(String::from("fail to get response from Api::SetSearchMap")),
    //     })?;
    //     Ok(())
    // }
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
    pub async fn get_metadata(&self) -> Result<Option<GrabMetadata>, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Option<GrabMetadata>>,
            oneshot::Receiver<Option<GrabMetadata>>,
        ) = oneshot::channel();
        self.tx_api
            .send(Api::GetMetadata(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::GetMetadata; error: {}", e,)),
            })?;
        Ok(rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::GetMetadata")),
        })?)
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
        canceler: CancellationToken,
    ) -> Result<bool, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<bool>, oneshot::Receiver<bool>) =
            oneshot::channel();
        self.tx_api
            .send(Api::AddOperation((uuid, canceler, tx_response)))
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
        filters: vec![],
        search_map: SearchMap::new(),
        metadata: None,
        operations: HashMap::new(),
        status: Status::Open,
    };
    let shutdown_caller = shutdown.clone();
    debug!(target: targets::SESSION, "task is started");
    select! {
        _ = async move {
            while let Some(msg) = rx_api.recv().await {
                match msg {
                    // Api::SetAssignedFile((file, rx_response)) => {
                    //     state.assigned_file = file;
                    //     if rx_response.send(()).is_err() {
                    //         return Err(NativeError {
                    //             severity: Severity::ERROR,
                    //             kind: NativeErrorKind::ChannelError,
                    //             message: Some(String::from("fail to response to Api::SetAssignedFile")),
                    //         });
                    //     }
                    // }
                    // Api::GetAssignedFile(rx_response) => {
                    //     if rx_response.send(state.assigned_file.clone()).is_err() {
                    //         return Err(NativeError {
                    //             severity: Severity::ERROR,
                    //             kind: NativeErrorKind::ChannelError,
                    //             message: Some(String::from("fail to response to Api::GetAssignedFile")),
                    //         });
                    //     }
                    // }
                    // Api::SetFilters((filters, rx_response)) => {
                    //     state.filters = filters;
                    //     if rx_response.send(()).is_err() {
                    //         return Err(NativeError {
                    //             severity: Severity::ERROR,
                    //             kind: NativeErrorKind::ChannelError,
                    //             message: Some(String::from("fail to response to Api::SetFilters")),
                    //         });
                    //     }
                    // }
                    // Api::GetFilters(rx_response) => {
                    //     if rx_response.send(state.filters.clone()).is_err() {
                    //         return Err(NativeError {
                    //             severity: Severity::ERROR,
                    //             kind: NativeErrorKind::ChannelError,
                    //             message: Some(String::from("fail to response to Api::GetFilters")),
                    //         });
                    //     }
                    // }
                    // Api::SetSearchMap((search_map, rx_response)) => {
                    //     state.search_map = search_map;
                    //     if rx_response.send(()).is_err() {
                    //         return Err(NativeError {
                    //             severity: Severity::ERROR,
                    //             kind: NativeErrorKind::ChannelError,
                    //             message: Some(String::from("fail to response to Api::SetSearchMap")),
                    //         });
                    //     }
                    // }
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
                    Api::GetMetadata(rx_response) => {
                        if rx_response.send(state.metadata.clone()).is_err() {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(String::from("fail to response to Api::GetMetadata")),
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
                    Api::AddOperation((uuid, token, rx_response)) => {
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
                    Api::Shutdown => {
                        debug!(target: targets::SESSION, "shutdown has been requested");
                        shutdown_caller.cancel();
                    }
                }
            }
            Ok(())
        } => {},
        _ = shutdown.cancelled() => {}
    };
    debug!(target: targets::SESSION, "task is finished");
    Ok(())
}
