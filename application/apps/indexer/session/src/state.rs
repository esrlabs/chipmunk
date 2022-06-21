use crate::{
    events::{CallbackEvent, NativeError, NativeErrorKind},
    operations::OperationStat,
};
use indexer_base::progress::Severity;
use log::{debug, error};
use processor::search::SearchResults;
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

impl SearchHolderState {
    pub fn execute_search(&mut self) -> Option<SearchResults> {
        match self {
            Self::Available(h) => Some(h.execute_search()),
            _ => None,
        }
    }
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

impl std::fmt::Display for Api {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Self::SetSessionFile(_) => "SetSessionFile",
                Self::GetSessionFile(_) => "GetSessionFile",
                Self::UpdateSession(_) => "UpdateSession",
                Self::FileRead(_) => "FileRead",
                Self::Grab(_) => "Grab",
                Self::SetStreamLen(_) => "SetStreamLen",
                Self::GetStreamLen(_) => "GetStreamLen",
                Self::GetSearchResultLen(_) => "GetSearchResultLen",
                Self::UpdateSearchResult(_) => "UpdateSearchResult",
                Self::GetSearchHolder(_) => "GetSearchHolder",
                Self::SetSearchHolder(_) => "SetSearchHolder",
                Self::DropSearch(_) => "DropSearch",
                Self::GrabSearch(_) => "GrabSearch",
                Self::GetSearchMap(_) => "GetSearchMap",
                Self::SetMatches(_) => "SetMatches",
                Self::AddOperation(_) => "AddOperation",
                Self::RemoveOperation(_) => "RemoveOperation",
                Self::CancelOperation(_) => "CancelOperation",
                Self::CloseSession(_) => "CloseSession",
                Self::SetDebugMode(_) => "SetDebugMode",
                Self::GetOperationsStat(_) => "GetOperationStat",
                Self::Shutdown => "Shutdown",
            }
        )
    }
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

    async fn exec_operation<T>(
        &self,
        api: Api,
        rx_response: oneshot::Receiver<T>,
    ) -> Result<T, NativeError> {
        let api_str = format!("{}", api);
        self.tx_api.send(api).map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(format!("Failed to send to Api::{}; error: {}", api_str, e)),
        })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(format!("Failed to get response from Api::{}", api_str)),
        })
    }

    pub async fn grab(&self, range: LineRange) -> Result<GrabbedContent, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::Grab((range.clone(), tx)), rx)
            .await?
    }

    pub async fn grab_search(&self, range: LineRange) -> Result<GrabbedContent, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GrabSearch((range, tx)), rx)
            .await?
    }

    pub async fn get_stream_len(&self) -> Result<usize, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetStreamLen(tx), rx).await?
    }

    pub async fn get_search_result_len(&self) -> Result<usize, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSearchResultLen(tx), rx).await
    }

    pub async fn get_search_map(&self) -> Result<SearchMap, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSearchMap(tx), rx).await
    }

    pub async fn set_session_file(&self, session_file: PathBuf) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetSessionFile((session_file, tx)), rx)
            .await?
    }

    pub async fn get_session_file(&self) -> Result<PathBuf, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSessionFile(tx), rx).await?
    }

    pub async fn update_session(&self) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::UpdateSession(tx), rx).await?
    }

    pub async fn file_read(&self) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::FileRead(tx), rx).await
    }

    pub async fn set_stream_len(&self, len: u64) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetStreamLen((len, tx)), rx).await
    }

    pub async fn update_search_result(
        &self,
        search_result_file: &Path,
    ) -> Result<usize, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(
            Api::UpdateSearchResult((PathBuf::from(search_result_file), tx)),
            rx,
        )
        .await?
    }

    pub async fn get_search_holder(&self) -> Result<SearchHolder, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSearchHolder(tx), rx).await?
    }

    pub async fn set_search_holder(&self, holder: SearchHolder) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetSearchHolder((holder, tx)), rx)
            .await?
    }

    pub async fn drop_search(&self) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::DropSearch(tx), rx).await
    }

    pub async fn set_matches(&self, matches: Option<Vec<FilterMatch>>) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetMatches((matches, tx)), rx)
            .await
    }

    pub async fn add_operation(
        &self,
        uuid: Uuid,
        name: String,
        canceler: CancellationToken,
        done: CancellationToken,
    ) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::AddOperation((uuid, name, canceler, done, tx)), rx)
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

    pub async fn close_session(&self) -> Result<(), NativeError> {
        self.closing_token.cancel();
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::CloseSession(tx), rx).await
    }

    pub async fn set_debug(&self, debug: bool) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetDebugMode((debug, tx)), rx)
            .await
    }

    pub async fn get_operations_stat(&self) -> Result<String, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetOperationsStat(tx), rx).await?
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
    let grabber: &mut std::boxed::Box<processor::grabber::Grabber> = match state.search_grabber {
        Some(ref mut grabber) => grabber,
        None => {
            let grabber = Grabber::lazy(TextFileSource::new(
                search_result_file,
                &search_result_file.to_string_lossy(),
            ))
            .map_err(|err| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!(
                    "Failed to create search result file ({}) grabber. Error: {}",
                    search_result_file.to_string_lossy(),
                    err
                )),
            })?;
            state.search_grabber = Some(Box::new(grabber));
            state.search_grabber.as_mut().expect("Was just set")
        }
    };

    grabber.update_from_file(Some(cancellation_token))?;
    grabber
        .get_metadata()
        .ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some("Grabber doesn't have metadata".to_string()),
        })
        .map(|mt| mt.line_count)
}

pub async fn run(
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
    let state_cancellation_token = CancellationToken::new();
    debug!("task is started");
    while let Some(msg) = rx_api.recv().await {
        match msg {
            Api::SetSessionFile((session_file, tx_response)) => {
                let res = state.handle_set_session_file(session_file);
                tx_response.send(res).map_err(|_| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::ChannelError,
                    message: Some(String::from("Failed to response to Api::SetSessionFile")),
                })?;
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
                tx_response.send(res).map_err(|_| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::ChannelError,
                    message: Some(String::from("Failed to respond to Api::GetSessionFile")),
                })?;
            }
            Api::Grab((range, tx_response)) => {
                let result = if let Some(ref mut grabber) = state.content_grabber {
                    Ok(grabber.grab_content(&range)?)
                } else {
                    Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Grabber,
                        message: Some(String::from("Grabber isn't inited")),
                    })
                };
                tx_response
                    .send(result)
                    .map_err(|_| channel_broken("Failed to respond to Api::Grab"))?;
            }
            Api::GrabSearch((range, tx_response)) => {
                tx_response
                    .send(state.handle_grab_search(range))
                    .map_err(|_| channel_broken("Failed to respond to Api::GrabbedContent"))?;
            }
            Api::GetSearchMap(tx_response) => {
                tx_response
                    .send(state.search_map.clone())
                    .map_err(|_| channel_broken("Failed to respond to Api::GetSearchMap"))?;
            }
            Api::UpdateSession(tx_response) => {
                let res = state
                    .handle_update_session(
                        state_cancellation_token.clone(),
                        tx_callback_events.clone(),
                    )
                    .await;
                tx_response
                    .send(res)
                    .map_err(|_| channel_broken("Failed to respond to Api::UpdateSession"))?;
            }
            Api::FileRead(tx_response) => {
                tx_callback_events.send(CallbackEvent::FileRead)?;
                tx_response
                    .send(())
                    .map_err(|_| channel_broken("Failed to respond to Api::FileRead"))?;
            }
            Api::SetStreamLen((len, tx_response)) => {
                state.search_map.set_stream_len(len);
                tx_response
                    .send(())
                    .map_err(|_| channel_broken("Failed to respond to Api::SetStreamLen"))?;
            }
            Api::GetStreamLen(tx_response) => {
                tx_response
                    .send(state.handle_get_stream_len())
                    .map_err(|_| channel_broken("Failed to respond to Api::GetStreamLen"))?;
            }
            Api::GetSearchResultLen(tx_response) => {
                let len = if let Some(ref grabber) = state.search_grabber {
                    grabber.get_metadata().map(|md| md.line_count).unwrap_or(0)
                } else {
                    0
                };
                tx_response
                    .send(len)
                    .map_err(|_| channel_broken("Failed to respond to Api::GetSearchResultLen"))?;
            }
            Api::UpdateSearchResult((search_result_file, tx_response)) => {
                tx_response
                    .send(
                        update_search_result(
                            &mut state,
                            &search_result_file,
                            state_cancellation_token.clone(),
                        )
                        .await,
                    )
                    .map_err(|_| channel_broken("Failed to respond to Api::UpdateSearchResult"))?;
            }
            Api::GetSearchHolder(tx_response) => {
                tx_response
                    .send(state.handle_get_search_holder())
                    .map_err(|_| channel_broken("Failed to respond to Api::GetSearchHolder"))?;
            }
            Api::SetSearchHolder((search_holder, tx_response)) => {
                let result = if matches!(state.search_holder, SearchHolderState::InUse) {
                    state.search_holder = SearchHolderState::Available(search_holder);
                    Ok(())
                } else {
                    Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ChannelError,
                        message: Some(String::from("Cannot set search holder - it wasn't in use")),
                    })
                };
                tx_response
                    .send(result)
                    .map_err(|_| channel_broken("Failed to respond to Api::SetSearchHolder"))?;
            }
            Api::DropSearch(tx_response) => {
                let result = if matches!(state.search_holder, SearchHolderState::InUse) {
                    false
                } else {
                    state.search_grabber = None;
                    state.search_holder = SearchHolderState::NotInited;
                    state.search_map.set(None);
                    tx_callback_events.send(CallbackEvent::SearchUpdated(0))?;
                    true
                };
                tx_response
                    .send(result)
                    .map_err(|_| channel_broken("Failed to respond to Api::DropSearch"))?;
            }
            Api::SetMatches((matches, tx_response)) => {
                state.search_map.set(matches);
                tx_response
                    .send(())
                    .map_err(|_| channel_broken("Failed to respond to Api::SetMatches"))?;
            }
            Api::AddOperation((uuid, name, cancalation_token, done_token, tx_response)) => {
                if state.debug {
                    state.stat.push(OperationStat::new(uuid.to_string(), name));
                }
                tx_response
                    .send(match state.operations.entry(uuid) {
                        Entry::Vacant(entry) => {
                            entry.insert((cancalation_token, done_token));
                            true
                        }
                        _ => false,
                    })
                    .map_err(|_| channel_broken("Failed to respond to Api::AddOperation"))?;
            }
            Api::RemoveOperation((uuid, tx_response)) => {
                if state.debug {
                    let str_uuid = uuid.to_string();
                    if let Some(index) = state.stat.iter().position(|op| op.uuid == str_uuid) {
                        state.stat[index].done();
                    } else {
                        error!("Failed to find operation in stat: {}", str_uuid);
                    }
                }
                tx_response
                    .send(state.operations.remove(&uuid).is_some())
                    .map_err(|_| channel_broken("Failed to respond to Api::RemoveOperation"))?;
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
                                // FIXME This will block us
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
                state_cancellation_token.cancel();
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
                state_cancellation_token.cancel();
                debug!("shutdown has been requested");
                break;
            }
        }
    }
    debug!("task is finished");
    Ok(())
}

impl SessionState {
    fn handle_set_session_file(&mut self, session_file: PathBuf) -> Result<(), NativeError> {
        if self.content_grabber.is_some() {
            Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(String::from("Grabber has been already inited")),
            })
        } else {
            self.session_file = Some(session_file.clone());
            Ok(Grabber::lazy(TextFileSource::new(
                &session_file,
                &session_file.to_string_lossy(),
            ))
            .map(|g| self.content_grabber = Some(Box::new(g)))?)
        }
    }

    fn handle_grab_search(&mut self, range: LineRange) -> Result<GrabbedContent, NativeError> {
        let result = if let Some(ref mut grabber) = self.search_grabber {
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
                let pos = el.content.parse::<u64>().map_err(|err| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::OperationSearch,
                    message: Some(format!("Cannot parse line number: {}", err)),
                })?;
                if i == 0 {
                    from_pos = pos;
                } else if to_pos + 1 != pos {
                    ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
                    from_pos = pos;
                }
                to_pos = pos;
            }
            if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from_pos)
                || (ranges.is_empty() && !line_numbers.grabbed_elements.is_empty())
            {
                ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
            }
            let mut row: usize = range.start() as usize;
            for range in ranges.iter() {
                let grabber = &mut (self.content_grabber.as_ref().ok_or(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Grabber,
                    message: Some(String::from("Grabber isn't inited")),
                })?);
                let mut session_grabbed = grabber.grab_content(&LineRange::from(range.clone()))?;

                let start = *range.start() as usize;
                for (j, element) in session_grabbed.grabbed_elements.iter_mut().enumerate() {
                    element.pos = Some(start + j);
                    element.row = Some(row);
                    row += 1;
                }
                search_grabbed
                    .grabbed_elements
                    .append(&mut session_grabbed.grabbed_elements);
            }
            Ok(search_grabbed)
        } else {
            Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(String::from("Search grabber isn't inited")),
            })
        };
        result
    }

    fn handle_get_stream_len(&mut self) -> Result<usize, NativeError> {
        if let Some(ref grabber) = self.content_grabber {
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
        }
    }

    async fn handle_update_session(
        &mut self,
        state_cancellation_token: CancellationToken,
        tx_callback_events: UnboundedSender<CallbackEvent>,
    ) -> Result<bool, NativeError> {
        if let Some(ref mut grabber) = self.content_grabber {
            let prev = grabber.log_entry_count().unwrap_or(0) as u64;
            grabber.update_from_file(Some(state_cancellation_token.clone()))?;
            let current = grabber.log_entry_count().unwrap_or(0) as u64;
            if prev != current {
                tx_callback_events.send(CallbackEvent::StreamUpdated(current))?;

                match self.search_holder.execute_search() {
                    Some(Ok((file_path, mut matches, _stats))) => {
                        self.search_map.append(&mut matches);
                        match update_search_result(
                            self,
                            &file_path,
                            state_cancellation_token.clone(),
                        )
                        .await
                        {
                            Ok(found) => {
                                tx_callback_events
                                    .send(CallbackEvent::SearchUpdated(found as u64))?;
                            }
                            Err(err) => {
                                error!("Fail to update search results: {:?}", err);
                            }
                        };
                    }
                    Some(Err(err)) => error!("Fail to append search: {}", err),
                    None => (),
                }
                Ok(true)
            } else {
                Ok(false)
            }
        } else {
            Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(String::from("Grabber isn't inited")),
            })
        }
    }

    fn handle_get_search_holder(&mut self) -> Result<SearchHolder, NativeError> {
        match self.search_holder {
            SearchHolderState::Available(_) => {
                use std::mem;
                if let SearchHolderState::Available(holder) =
                    mem::replace(&mut self.search_holder, SearchHolderState::InUse)
                {
                    Ok(holder)
                } else {
                    Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Configuration,
                        message: Some(String::from("Could not replace search holder in state")),
                    })
                }
            }
            SearchHolderState::InUse => Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ChannelError,
                message: Some(String::from("Search holder is in use")),
            }),
            SearchHolderState::NotInited => {
                if let Some(session_file) = self.session_file.as_ref() {
                    self.search_holder = SearchHolderState::InUse;
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
        }
    }
}

fn channel_broken(msg: &str) -> NativeError {
    NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::ChannelError,
        message: Some(String::from(msg)),
    }
}
