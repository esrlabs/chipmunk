use crate::js::session::events::{NativeError, NativeErrorKind};
use indexer_base::progress::Severity;
use processor::{
    grabber::GrabMetadata,
    map::{FilterMatch, SearchMap},
    search::SearchFilter,
};
use tokio::sync::{
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    oneshot,
};

pub enum API {
    SetAssignedFile((Option<String>, oneshot::Sender<()>)),
    GetAssignedFile(oneshot::Sender<Option<String>>),
    SetFilters((Vec<SearchFilter>, oneshot::Sender<()>)),
    GetFilters(oneshot::Sender<Vec<SearchFilter>>),
    SetSearchMap((SearchMap, oneshot::Sender<()>)),
    GetSearchMap(oneshot::Sender<SearchMap>),
    SetMetadata((Option<GrabMetadata>, oneshot::Sender<()>)),
    GetMetadata(oneshot::Sender<Option<GrabMetadata>>),
    SetStreamLen((u64, oneshot::Sender<()>)),
    SetMatches((Option<Vec<FilterMatch>>, oneshot::Sender<()>)),
}

#[derive(Debug)]
pub struct SessionState {
    pub assigned_file: Option<String>,
    pub filters: Vec<SearchFilter>,
    pub search_map: SearchMap,
    pub metadata: Option<GrabMetadata>,
}

#[derive(Clone)]
pub struct SessionStateAPI {
    tx_api: UnboundedSender<API>,
}

impl SessionStateAPI {
    pub fn new() -> (Self, UnboundedReceiver<API>) {
        let (tx_api, mut rx_api): (UnboundedSender<API>, UnboundedReceiver<API>) =
            unbounded_channel();
        (SessionStateAPI { tx_api }, rx_api)
    }
    pub async fn set_assigned_file(&self, file: Option<String>) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(API::SetAssignedFile((file, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to send to API::SetAssignedFile; error: {}",
                    e,
                )),
            })?;
        rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from API::SetAssignedFile",
            )),
        })?;
        Ok(())
    }
    pub async fn get_assigned_file(&self) -> Result<Option<String>, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Option<String>>,
            oneshot::Receiver<Option<String>>,
        ) = oneshot::channel();
        self.tx_api
            .send(API::GetAssignedFile(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to send to API::GetAssignedFile; error: {}",
                    e,
                )),
            })?;
        Ok(rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from API::GetAssignedFile",
            )),
        })?)
    }
    pub async fn set_filters(&self, filters: Vec<SearchFilter>) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(API::SetFilters((filters, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to API::SetFilters; error: {}", e,)),
            })?;
        rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from API::SetFilters")),
        })?;
        Ok(())
    }
    pub async fn get_filters(&self) -> Result<Vec<SearchFilter>, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Vec<SearchFilter>>,
            oneshot::Receiver<Vec<SearchFilter>>,
        ) = oneshot::channel();
        self.tx_api
            .send(API::GetFilters(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to API::GetFilters; error: {}", e,)),
            })?;
        Ok(rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from API::GetFilters")),
        })?)
    }
    pub async fn set_search_map(&self, map: SearchMap) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(API::SetSearchMap((map, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to API::SetSearchMap; error: {}", e,)),
            })?;
        rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from API::SetSearchMap")),
        })?;
        Ok(())
    }
    pub async fn get_search_map(&self) -> Result<SearchMap, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<SearchMap>, oneshot::Receiver<SearchMap>) =
            oneshot::channel();
        self.tx_api
            .send(API::GetSearchMap(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to API::GetSearchMap; error: {}", e,)),
            })?;
        Ok(rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from API::GetSearchMap")),
        })?)
    }
    pub async fn set_metadata(&self, meta: Option<GrabMetadata>) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(API::SetMetadata((meta, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to API::SetMetadata; error: {}", e,)),
            })?;
        rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from API::SetMetadata")),
        })?;
        Ok(())
    }
    pub async fn get_metadata(&self) -> Result<Option<GrabMetadata>, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Option<GrabMetadata>>,
            oneshot::Receiver<Option<GrabMetadata>>,
        ) = oneshot::channel();
        self.tx_api
            .send(API::GetMetadata(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to API::GetMetadata; error: {}", e,)),
            })?;
        Ok(rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from API::GetMetadata")),
        })?)
    }
    pub async fn set_stream_len(&self, len: u64) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(API::SetStreamLen((len, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to API::SetStreamLen; error: {}", e,)),
            })?;
        rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from API::SetStreamLen")),
        })?;
        Ok(())
    }
    pub async fn set_matches(&self, matches: Option<Vec<FilterMatch>>) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(API::SetMatches((matches, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to API::SetMatches; error: {}", e,)),
            })?;
        rx_response.await.map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from API::SetMatches")),
        })?;
        Ok(())
    }
}

pub async fn task(mut rx_api: UnboundedReceiver<API>) -> Result<(), NativeError> {
    let mut state = SessionState {
        assigned_file: None,
        filters: vec![],
        search_map: SearchMap::new(),
        metadata: None,
    };
    while let Some(msg) = rx_api.recv().await {
        match msg {
            API::SetAssignedFile((file, rx_response)) => {
                state.assigned_file = file;
                if rx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to API::SetAssignedFile")),
                    });
                }
            }
            API::GetAssignedFile(rx_response) => {
                if rx_response.send(state.assigned_file.clone()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to API::GetAssignedFile")),
                    });
                }
            }
            API::SetFilters((filters, rx_response)) => {
                state.filters = filters;
                if rx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to API::SetFilters")),
                    });
                }
            }
            API::GetFilters(rx_response) => {
                if rx_response.send(state.filters.clone()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to API::GetFilters")),
                    });
                }
            }
            API::SetSearchMap((search_map, rx_response)) => {
                state.search_map = search_map;
                if rx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to API::SetSearchMap")),
                    });
                }
            }
            API::GetSearchMap(rx_response) => {
                if rx_response.send(state.search_map.clone()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to API::GetSearchMap")),
                    });
                }
            }
            API::SetMetadata((metadata, rx_response)) => {
                state.metadata = metadata;
                if rx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to API::SetMetadata")),
                    });
                }
            }
            API::GetMetadata(rx_response) => {
                if rx_response.send(state.metadata.clone()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to API::GetMetadata")),
                    });
                }
            }
            API::SetStreamLen((len, rx_response)) => {
                state.search_map.set_stream_len(len);
                if rx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to API::SetStreamLen")),
                    });
                }
            }
            API::SetMatches((matches, rx_response)) => {
                state.search_map.set(matches);
                if rx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to API::SetMatches")),
                    });
                }
            }
        }
    }
    Ok(())
}
