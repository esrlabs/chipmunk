use crate::{
    events::{CallbackEvent, NativeError, NativeErrorKind},
    operations::OperationStat,
};
use indexer_base::progress::Severity;
use log::{debug, error};
use processor::{
    grabber::{GrabbedContent, Grabber, LineRange},
    map::{FilterMatch, SearchMap},
    search::SearchHolder,
    text_source::TextFileSource,
};
use std::{
    collections::{hash_map::Entry, HashMap},
    path::{Path, PathBuf},
};
use tokio::sync::{
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    oneshot,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Debug)]
pub enum SearchHolderState {
    Available(SearchHolder),
    InUse,
    NotInited,
}

pub enum Api {
    SetSessionFile((PathBuf, oneshot::Sender<Result<(), NativeError>>)),
    GetSessionFile(oneshot::Sender<Result<PathBuf, NativeError>>),
    UpdateSession(oneshot::Sender<Result<bool, NativeError>>),
    FileRead(oneshot::Sender<()>),
    Grab(
        (
            LineRange,
            oneshot::Sender<Result<GrabbedContent, NativeError>>,
        ),
    ),
    SetStreamLen((u64, oneshot::Sender<()>)),
    GetStreamLen(oneshot::Sender<Result<usize, NativeError>>),
    GetSearchResultLen(oneshot::Sender<usize>),
    UpdateSearchResult((PathBuf, oneshot::Sender<Result<usize, NativeError>>)),
    GetSearchHolder(oneshot::Sender<Result<SearchHolder, NativeError>>),
    SetSearchHolder((SearchHolder, oneshot::Sender<Result<(), NativeError>>)),
    DropSearch(oneshot::Sender<bool>),
    GrabSearch(
        (
            LineRange,
            oneshot::Sender<Result<GrabbedContent, NativeError>>,
        ),
    ),
    GetSearchMap(oneshot::Sender<SearchMap>),
    SetMatches((Option<Vec<FilterMatch>>, oneshot::Sender<()>)),
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
    pub session_file: Option<PathBuf>,
    pub search_map: SearchMap,
    pub search_holder: SearchHolderState,
    pub content_grabber: Option<Box<Grabber>>,
    pub search_grabber: Option<Box<Grabber>>,
    pub operations: HashMap<Uuid, (CancellationToken, CancellationToken)>,
    pub status: Status,
    // stat is used only in debug = true tp collect some stat-info
    pub stat: Vec<OperationStat>,
    pub debug: bool,
}

#[derive(Clone, Debug)]
pub struct SessionStateAPI {
    tx_api: UnboundedSender<Api>,
    closing_token: CancellationToken,
}

#[allow(clippy::type_complexity)]
impl SessionStateAPI {
    pub fn new() -> (Self, UnboundedReceiver<Api>) {
        let (tx_api, rx_api): (UnboundedSender<Api>, UnboundedReceiver<Api>) = unbounded_channel();
        (
            SessionStateAPI {
                tx_api,
                closing_token: CancellationToken::new(),
            },
            rx_api,
        )
    }

    pub async fn grab(&self, range: LineRange) -> Result<GrabbedContent, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Result<GrabbedContent, NativeError>>,
            oneshot::Receiver<Result<GrabbedContent, NativeError>>,
        ) = oneshot::channel();
        self.tx_api
            .send(Api::Grab((range.clone(), tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::Grab; error: {}", e,)),
            })?;
        match rx_response.await {
            Ok(res) => res,
            Err(err) => Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to get response from Api::Grab; error: {}",
                    err
                )),
            }),
        }
    }

    pub async fn grab_search(&self, range: LineRange) -> Result<GrabbedContent, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Result<GrabbedContent, NativeError>>,
            oneshot::Receiver<Result<GrabbedContent, NativeError>>,
        ) = oneshot::channel();
        self.tx_api
            .send(Api::GrabSearch((range, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::GrabSearch; error: {}", e,)),
            })?;
        match rx_response.await {
            Ok(res) => res,
            Err(err) => Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to get response from Api::GrabSearch; error: {}",
                    err
                )),
            }),
        }
    }

    pub async fn get_stream_len(&self) -> Result<usize, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Result<usize, NativeError>>,
            oneshot::Receiver<Result<usize, NativeError>>,
        ) = oneshot::channel();
        self.tx_api
            .send(Api::GetStreamLen(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::GetStreamLen; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::GetStreamLen")),
        })?
    }

    pub async fn get_search_result_len(&self) -> Result<usize, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<usize>, oneshot::Receiver<usize>) =
            oneshot::channel();
        self.tx_api
            .send(Api::GetSearchResultLen(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to send to Api::GetSearchResultLen; error: {}",
                    e,
                )),
            })?;
        Ok(rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from Api::GetSearchResultLen",
            )),
        })?)
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

    pub async fn set_session_file(&self, session_file: PathBuf) -> Result<(), NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Result<(), NativeError>>,
            oneshot::Receiver<Result<(), NativeError>>,
        ) = oneshot::channel();
        self.tx_api
            .send(Api::SetSessionFile((session_file, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::SetSessionFile; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from Api::SetSessionFile",
            )),
        })?
    }

    pub async fn get_session_file(&self) -> Result<PathBuf, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Result<PathBuf, NativeError>>,
            oneshot::Receiver<Result<PathBuf, NativeError>>,
        ) = oneshot::channel();
        self.tx_api
            .send(Api::GetSessionFile(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::GetSessionFile; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from Api::GetSessionFile",
            )),
        })?
    }

    pub async fn update_session(&self) -> Result<bool, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Result<bool, NativeError>>,
            oneshot::Receiver<Result<bool, NativeError>>,
        ) = oneshot::channel();
        self.tx_api
            .send(Api::UpdateSession(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::UpdateSession; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::UpdateSession")),
        })?
    }

    pub async fn file_read(&self) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_api
            .send(Api::FileRead(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::FileRead; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::FileRead")),
        })?;
        Ok(())
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

    pub async fn update_search_result(
        &self,
        search_result_file: PathBuf,
    ) -> Result<usize, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Result<usize, NativeError>>,
            oneshot::Receiver<Result<usize, NativeError>>,
        ) = oneshot::channel();
        self.tx_api
            .send(Api::UpdateSearchResult((search_result_file, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to send to Api::UpdateSearchResult; error: {}",
                    e,
                )),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from Api::UpdateSearchResult",
            )),
        })?
    }

    pub async fn get_search_holder(&self) -> Result<SearchHolder, NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Result<SearchHolder, NativeError>>,
            oneshot::Receiver<Result<SearchHolder, NativeError>>,
        ) = oneshot::channel();
        self.tx_api
            .send(Api::GetSearchHolder(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to send to Api::GetSearchHolder; error: {}",
                    e,
                )),
            })?;
        match rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from Api::GetSearchHolder",
            )),
        }) {
            Ok(res) => res,
            Err(err) => Err(err),
        }
    }

    pub async fn set_search_holder(&self, holder: SearchHolder) -> Result<(), NativeError> {
        let (tx_response, rx_response): (
            oneshot::Sender<Result<(), NativeError>>,
            oneshot::Receiver<Result<(), NativeError>>,
        ) = oneshot::channel();
        self.tx_api
            .send(Api::SetSearchHolder((holder, tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!(
                    "fail to send to Api::SetSearchHolder; error: {}",
                    e,
                )),
            })?;
        match rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(
                "fail to get response from Api::SetSearchHolder",
            )),
        }) {
            Ok(res) => res,
            Err(err) => Err(err),
        }
    }

    pub async fn drop_search(&self) -> Result<bool, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<bool>, oneshot::Receiver<bool>) =
            oneshot::channel();
        self.tx_api
            .send(Api::DropSearch(tx_response))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(format!("fail to send to Api::DropSearch; error: {}", e,)),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from("fail to get response from Api::DropSearch")),
        })
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

    pub async fn close_session(&self) -> Result<(), NativeError> {
        self.closing_token.cancel();
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

    pub fn is_closing(&self) -> bool {
        self.closing_token.is_cancelled()
    }
}

pub async fn update_search_result(
    state: &mut SessionState,
    search_result_file: &Path,
    cancellation_token: CancellationToken,
) -> Result<usize, NativeError> {
    let result = if state.search_grabber.is_none() {
        match Grabber::lazy(TextFileSource::new(
            search_result_file,
            &search_result_file.to_string_lossy(),
        )) {
            Ok(grabber) => {
                state.search_grabber = Some(Box::new(grabber));
                Ok(0)
            }
            Err(err) => Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Failed to create search result file ({}) grabber. Error: {}",
                    search_result_file.to_string_lossy(),
                    err
                )),
            }),
        }
    } else {
        Ok(0)
    };
    // To check: probably we need spetial canceler for search to prevent possible issues
    // on dropping search between searches
    if result.is_err() {
        result
    } else if let Some(ref mut grabber) = state.search_grabber {
        if let Err(err) = grabber.update_from_file(Some(cancellation_token)) {
            Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!("Fail update metadata: {}", err)),
            })
        } else if let Some(mt) = grabber.get_metadata() {
            Ok(mt.line_count)
        } else {
            Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some("Grabber doesn't have metadata".to_string()),
            })
        }
    } else {
        Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(String::from("Grabber isn't inited")),
        })
    }
}

pub async fn task(
    mut rx_api: UnboundedReceiver<Api>,
    tx_callback_events: UnboundedSender<CallbackEvent>,
) -> Result<(), NativeError> {
    let mut state = SessionState {
        session_file: None,
        search_map: SearchMap::new(),
        search_holder: SearchHolderState::NotInited,
        content_grabber: None,
        search_grabber: None,
        operations: HashMap::new(),
        status: Status::Open,
        stat: vec![],
        debug: false,
    };
    let task_cancellation_token = CancellationToken::new();
    debug!("task is started");
    while let Some(msg) = rx_api.recv().await {
        match msg {
            Api::SetSessionFile((session_file, tx_response)) => {
                if state.content_grabber.is_some() {
                    if tx_response
                        .send(Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Grabber,
                            message: Some(String::from("Grabber has been already inited")),
                        }))
                        .is_err()
                    {
                        return Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::ChannelError,
                            message: Some(String::from("fail to response to Api::SetSessionFile")),
                        });
                    }
                    continue;
                }
                state.session_file = Some(session_file.clone());
                let result = match Grabber::lazy(TextFileSource::new(
                    &session_file,
                    &session_file.to_string_lossy(),
                )) {
                    Ok(grabber) => {
                        state.content_grabber = Some(Box::new(grabber));
                        Ok(())
                    }
                    Err(err) => Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Grabber,
                        message: Some(format!(
                            "Failed to create session file ({}) grabber. Error: {}",
                            session_file.to_string_lossy(),
                            err
                        )),
                    }),
                };
                if tx_response.send(result.clone()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::SetSessionFile")),
                    });
                }
                if let Err(err) = result {
                    return Err(err);
                }
            }
            Api::GetSessionFile(tx_response) => {
                let res = if let Some(ref session_file) = state.session_file {
                    Ok(session_file.clone())
                } else {
                    Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Grabber,
                        message: Some(String::from("Session file isn't assigned yet")),
                    })
                };
                if tx_response.send(res).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::GetSessionFile")),
                    });
                }
            }
            Api::Grab((range, tx_response)) => {
                let result = if let Some(ref mut grabber) = state.content_grabber {
                    grabber.grab_content(&range).map_err(|e| NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Grabber,
                        message: Some(format!("Failed to grab data. Error: {}", e)),
                    })
                } else {
                    Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Grabber,
                        message: Some(String::from("Grabber isn't inited")),
                    })
                };
                if tx_response.send(result.clone()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::Grab")),
                    });
                }
                if let Err(err) = result {
                    return Err(err);
                }
            }
            Api::GrabSearch((range, tx_response)) => {
                let result = if let Some(ref mut grabber) = state.search_grabber {
                    let line_numbers: GrabbedContent =
                        grabber.grab_content(&range).map_err(|e| NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Grabber,
                            message: Some(format!("Failed to grab search data. Error: {}", e)),
                        })?;
                    let mut search_grabbed: GrabbedContent = GrabbedContent {
                        grabbed_elements: vec![],
                    };
                    let mut ranges = vec![];
                    let mut from_pos: u64 = 0;
                    let mut to_pos: u64 = 0;
                    for (i, el) in line_numbers.grabbed_elements.iter().enumerate() {
                        match el.content.parse::<u64>() {
                            Ok(pos) => {
                                if i == 0 {
                                    from_pos = pos;
                                } else if to_pos + 1 != pos {
                                    ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
                                    from_pos = pos;
                                }
                                to_pos = pos;
                            }
                            Err(err) => {
                                return Err(NativeError {
                                    severity: Severity::ERROR,
                                    kind: NativeErrorKind::OperationSearch,
                                    message: Some(format!("Cannot parse line number: {}", err)),
                                });
                            }
                        }
                    }
                    if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from_pos)
                        || (ranges.is_empty() && !line_numbers.grabbed_elements.is_empty())
                    {
                        ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
                    }
                    let mut row: usize = range.start() as usize;
                    for range in ranges.iter() {
                        if let Some(ref mut grabber) = state.content_grabber {
                            // let mut session_grabbed = grabber
                            //     .grab_content(&LineRange::from(range.clone()))
                            //     .map_err(|e| NativeError {
                            //         severity: Severity::ERROR,
                            //         kind: NativeErrorKind::Grabber,
                            //         message: Some(format!("Failed to grab data. Error: {}", e)),
                            //     })?;
                            let mut session_grabbed =
                                match grabber.grab_content(&LineRange::from(range.clone())) {
                                    Ok(g) => g,
                                    Err(err) => {
                                        return Err(NativeError {
                                            severity: Severity::ERROR,
                                            kind: NativeErrorKind::Grabber,
                                            message: Some(format!(
                                                "Failed to grab data. Error: {}",
                                                err
                                            )),
                                        });
                                    }
                                };
                            let start = *range.start() as usize;
                            for (j, element) in
                                session_grabbed.grabbed_elements.iter_mut().enumerate()
                            {
                                element.pos = Some(start + j);
                                element.row = Some(row);
                                row += 1;
                            }
                            search_grabbed
                                .grabbed_elements
                                .append(&mut session_grabbed.grabbed_elements);
                        } else {
                            return Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::Grabber,
                                message: Some(String::from("Grabber isn't inited")),
                            });
                        }
                    }
                    Ok(search_grabbed)
                } else {
                    Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Grabber,
                        message: Some(String::from("Search grabber isn't inited")),
                    })
                };
                if tx_response.send(result.clone()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::GrabSearch")),
                    });
                }
                if let Err(err) = result {
                    return Err(err);
                }
            }
            Api::GetSearchMap(tx_response) => {
                if tx_response.send(state.search_map.clone()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::GetSearchMap")),
                    });
                }
            }
            Api::UpdateSession(tx_response) => {
                let result = if let Some(ref mut grabber) = state.content_grabber {
                    let prev = grabber.log_entry_count().unwrap_or(0) as u64;
                    if let Err(err) =
                        grabber.update_from_file(Some(task_cancellation_token.clone()))
                    {
                        Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Grabber,
                            message: Some(format!("Fail update metadata: {}", err)),
                        })
                    } else {
                        let current = grabber.log_entry_count().unwrap_or(0) as u64;
                        if prev != current {
                            if let Err(err) =
                                tx_callback_events.send(CallbackEvent::StreamUpdated(current))
                            {
                                return Err(NativeError {
                                    severity: Severity::ERROR,
                                    kind: NativeErrorKind::ChannelError,
                                    message: Some(format!("callback channel is broken: {}", err)),
                                });
                            }
                            Ok(true)
                        } else {
                            Ok(false)
                        }
                    }
                } else {
                    Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Grabber,
                        message: Some(String::from("Grabber isn't inited")),
                    })
                };
                if let Ok(updated) = result.as_ref() {
                    if updated == &true {
                        let mut matches = if let SearchHolderState::Available(mut search_holder) =
                            state.search_holder
                        {
                            let matches = match search_holder.execute_search() {
                                Ok((file_path, matches, _stats)) => Some((file_path, matches)),
                                Err(err) => {
                                    error!("Fail to append search: {}", err);
                                    None
                                }
                            };
                            state.search_holder = SearchHolderState::Available(search_holder);
                            matches
                        } else {
                            None
                        };
                        if let Some((file_path, mut matches)) = matches.take() {
                            state.search_map.append(&mut matches);
                            match update_search_result(
                                &mut state,
                                &file_path,
                                task_cancellation_token.clone(),
                            )
                            .await
                            {
                                Ok(found) => {
                                    if let Err(err) = tx_callback_events
                                        .send(CallbackEvent::SearchUpdated(found as u64))
                                    {
                                        return Err(NativeError {
                                            severity: Severity::ERROR,
                                            kind: NativeErrorKind::ChannelError,
                                            message: Some(format!(
                                                "callback channel is broken: {}",
                                                err
                                            )),
                                        });
                                    }
                                }
                                Err(err) => {
                                    error!("Fail to update search results: {:?}", err);
                                }
                            };
                        }
                    }
                }
                if tx_response.send(result.clone()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::UpdateSession")),
                    });
                }
                if let Err(err) = result {
                    return Err(err);
                }
            }
            Api::FileRead(tx_response) => {
                if let Err(err) = tx_callback_events.send(CallbackEvent::FileRead) {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(format!("callback channel is broken: {}", err)),
                    });
                }
                if tx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::UpdateSession")),
                    });
                }
            }
            Api::SetStreamLen((len, tx_response)) => {
                state.search_map.set_stream_len(len);
                if tx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::SetStreamLen")),
                    });
                }
            }
            Api::GetStreamLen(tx_response) => {
                let len = if let Some(ref grabber) = state.content_grabber {
                    if let Some(md) = grabber.get_metadata() {
                        Ok(md.line_count)
                    } else {
                        Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Grabber,
                            message: Some(String::from("Metadata isn't inited yet")),
                        })
                    }
                } else {
                    Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Grabber,
                        message: Some(String::from("Grabber isn't inited")),
                    })
                };
                if tx_response.send(len).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::GetStreamLen")),
                    });
                }
            }
            Api::GetSearchResultLen(tx_response) => {
                let len = if let Some(ref grabber) = state.search_grabber {
                    if let Some(md) = grabber.get_metadata() {
                        md.line_count
                    } else {
                        0
                    }
                } else {
                    0
                };
                if tx_response.send(len).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::GetSearchResultLen")),
                    });
                }
            }
            Api::UpdateSearchResult((search_result_file, tx_response)) => {
                if tx_response
                    .send(
                        update_search_result(
                            &mut state,
                            &search_result_file,
                            task_cancellation_token.clone(),
                        )
                        .await,
                    )
                    .is_err()
                {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::UpdateSearchResult")),
                    });
                }
            }
            Api::GetSearchHolder(tx_response) => {
                let result = match state.search_holder {
                    SearchHolderState::Available(holder) => {
                        state.search_holder = SearchHolderState::InUse;
                        Ok(holder)
                    }
                    SearchHolderState::InUse => Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("Search holder is in use")),
                    }),
                    SearchHolderState::NotInited => {
                        if let Some(session_file) = state.session_file.as_ref() {
                            state.search_holder = SearchHolderState::InUse;
                            Ok(SearchHolder::new(session_file, vec![].iter()))
                        } else {
                            Err(NativeError {
                                severity: Severity::ERROR,
                                kind: NativeErrorKind::ChannelError,
                                message: Some(String::from(
                                    "Cannot create search holder without session file.",
                                )),
                            })
                        }
                    }
                };
                if tx_response.send(result).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::GetSearchHolder")),
                    });
                }
            }
            Api::SetSearchHolder((search_holder, tx_response)) => {
                let result = if matches!(state.search_holder, SearchHolderState::InUse) {
                    state.search_holder = SearchHolderState::Available(search_holder);
                    Ok(())
                } else {
                    Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("cannot set search holder - it wasn't in use")),
                    })
                };
                if tx_response.send(result).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::SetSearchHolder")),
                    });
                }
            }
            Api::DropSearch(tx_response) => {
                if matches!(state.search_holder, SearchHolderState::InUse) {
                    if tx_response.send(false).is_err() {
                        return Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::ChannelError,
                            message: Some(String::from("fail to response to Api::DropSearch")),
                        });
                    }
                } else {
                    state.search_grabber = None;
                    state.search_holder = SearchHolderState::NotInited;
                    state.search_map.set(None);
                    if let Err(err) = tx_callback_events.send(CallbackEvent::SearchUpdated(0)) {
                        return Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::ChannelError,
                            message: Some(format!("callback channel is broken: {}", err)),
                        });
                    }
                    if tx_response.send(true).is_err() {
                        return Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::ChannelError,
                            message: Some(String::from("fail to response to Api::DropSearch")),
                        });
                    }
                }
            }
            Api::SetMatches((matches, tx_response)) => {
                state.search_map.set(matches);
                if tx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::SetMatches")),
                    });
                }
            }
            Api::AddOperation((uuid, name, cancalation_token, done_token, tx_response)) => {
                if state.debug {
                    state.stat.push(OperationStat::new(uuid.to_string(), name));
                }
                if tx_response
                    .send(match state.operations.entry(uuid) {
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
                if state.debug {
                    let str_uuid = uuid.to_string();
                    if let Some(index) = state.stat.iter().position(|op| op.uuid == str_uuid) {
                        state.stat[index].done();
                    } else {
                        error!("fail to find operation in stat: {}", str_uuid);
                    }
                }
                if tx_response
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
            Api::CancelOperation((uuid, tx_response)) => {
                if tx_response
                    .send(
                        if let Some((operation_cancalation_token, done_token)) =
                            state.operations.remove(&uuid)
                        {
                            if !done_token.is_cancelled() {
                                operation_cancalation_token.cancel();
                                debug!("waiting for operation {} would confirm done-state", uuid);
                                done_token.cancelled().await;
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
            Api::CloseSession(tx_response) => {
                task_cancellation_token.cancel();
                state.status = Status::Closed;
                for (uuid, (operation_cancalation_token, done_token)) in &state.operations {
                    if !done_token.is_cancelled() {
                        operation_cancalation_token.cancel();
                        debug!("waiting for operation {} would confirm done-state", uuid);
                        // TODO: add timeout to preven situation with waiting forever. 2-3 sec.
                        done_token.cancelled().await;
                    }
                }
                state.operations.clear();
                if tx_response.send(()).is_err() {
                    return Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("fail to response to Api::CloseSession")),
                    });
                }
            }
            Api::SetDebugMode((debug, tx_response)) => {
                state.debug = debug;
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
                task_cancellation_token.cancel();
                debug!("shutdown has been requested");
                break;
            }
        }
    }
    debug!("task is finished");
    Ok(())
}
