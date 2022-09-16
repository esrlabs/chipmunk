use crate::{
    events::{CallbackEvent, NativeError, NativeErrorKind},
    paths,
    tracker::OperationTrackerAPI,
};
use indexer_base::progress::Severity;
use log::{debug, error};
use processor::{
    grabber::{GrabbedContent, Grabber, LineRange},
    map::{FilterMatch, FiltersStats, NearestPosition, ScaledDistribution, SearchMap},
    search::{SearchHolder, SearchResults},
    text_source::TextFileSource,
};
use std::{
    collections::HashMap,
    fmt::Display,
    fs::File,
    io::{BufWriter, Write},
    path::PathBuf,
    time::Instant,
};
use tokio::sync::{
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    oneshot,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub const NOTIFY_IN_MS: u128 = 250;

#[derive(Debug)]
pub enum SearchHolderState {
    Available(SearchHolder),
    InUse,
    NotInited,
}

#[derive(Debug)]
pub enum SessionFile {
    Existed(PathBuf),
    ToBeCreated,
}

impl SearchHolderState {
    pub fn execute_search(
        &mut self,
        session_file_len: u64,
        cancel_token: CancellationToken,
    ) -> Option<SearchResults> {
        match self {
            Self::Available(h) => Some(h.execute_search(session_file_len, cancel_token)),
            _ => None,
        }
    }
}

pub enum Api {
    SetSessionFile((SessionFile, oneshot::Sender<Result<(), NativeError>>)),
    GetSessionFile(oneshot::Sender<Result<PathBuf, NativeError>>),
    WriteSessionFile((String, oneshot::Sender<Result<bool, NativeError>>)),
    FlushSessionFile(oneshot::Sender<Result<(), NativeError>>),
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
    GetSearchHolder((Uuid, oneshot::Sender<Result<SearchHolder, NativeError>>)),
    SetSearchHolder(
        (
            Option<SearchHolder>,
            Uuid,
            oneshot::Sender<Result<(), NativeError>>,
        ),
    ),
    DropSearch(oneshot::Sender<bool>),
    GrabSearch(
        (
            LineRange,
            oneshot::Sender<Result<GrabbedContent, NativeError>>,
        ),
    ),
    GetNearestPosition((u64, oneshot::Sender<Option<NearestPosition>>)),
    GetScaledMap((u16, Option<(u64, u64)>, oneshot::Sender<ScaledDistribution>)),
    SetMatches(
        (
            Option<Vec<FilterMatch>>,
            Option<FiltersStats>,
            oneshot::Sender<()>,
        ),
    ),
    CloseSession(oneshot::Sender<()>),
    SetDebugMode((bool, oneshot::Sender<()>)),
    NotifyCancelingOperation(Uuid),
    NotifyCanceledOperation(Uuid),
    Shutdown,
}

impl Display for Api {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Self::SetSessionFile(_) => "SetSessionFile",
                Self::GetSessionFile(_) => "GetSessionFile",
                Self::WriteSessionFile(_) => "WriteSessionFile",
                Self::FlushSessionFile(_) => "FlushSessionFile",
                Self::UpdateSession(_) => "UpdateSession",
                Self::FileRead(_) => "FileRead",
                Self::Grab(_) => "Grab",
                Self::SetStreamLen(_) => "SetStreamLen",
                Self::GetStreamLen(_) => "GetStreamLen",
                Self::GetSearchResultLen(_) => "GetSearchResultLen",
                Self::GetSearchHolder(_) => "GetSearchHolder",
                Self::SetSearchHolder(_) => "SetSearchHolder",
                Self::DropSearch(_) => "DropSearch",
                Self::GrabSearch(_) => "GrabSearch",
                Self::GetNearestPosition(_) => "GetNearestPosition",
                Self::GetScaledMap(_) => "GetScaledMap",
                Self::SetMatches(_) => "SetMatches",
                Self::CloseSession(_) => "CloseSession",
                Self::SetDebugMode(_) => "SetDebugMode",
                Self::NotifyCancelingOperation(_) => "NotifyCancelingOperation",
                Self::NotifyCanceledOperation(_) => "NotifyCanceledOperation",
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
    pub session_writer: Option<BufWriter<File>>,
    pub session_has_updates: bool,
    pub last_message_timestamp: Instant,
    pub search_map: SearchMap,
    pub search_holder: SearchHolderState,
    pub content_grabber: Option<Box<Grabber>>,
    pub cancelling_operations: HashMap<Uuid, bool>,
    pub status: Status,
    pub debug: bool,
}

impl SessionState {
    fn handle_set_session_file(&mut self, session_file: SessionFile) -> Result<(), NativeError> {
        if self.content_grabber.is_none() {
            let file = match session_file {
                SessionFile::Existed(session_file) => session_file,
                SessionFile::ToBeCreated => {
                    let streams = paths::get_streams_dir()?;
                    let file = streams.join(format!("{}.session", Uuid::new_v4()));
                    File::create(&file).map_err(|e| NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Io,
                        message: Some(format!(
                            "Fail to create session file {}: {}",
                            file.to_string_lossy(),
                            e
                        )),
                    })?;
                    file
                }
            };
            debug!("Session file setup: {}", file.to_string_lossy());
            self.session_file = Some(file.clone());
            Ok(
                Grabber::lazy(TextFileSource::new(&file, &file.to_string_lossy()))
                    .map(|g| self.content_grabber = Some(Box::new(g)))?,
            )
        } else {
            Ok(())
        }
    }

    fn handle_grab_search(&mut self, range: LineRange) -> Result<GrabbedContent, NativeError> {
        let indexes = self
            .search_map
            .indexes(&range.range)
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!("{}", e)),
            })?;
        let mut search_grabbed: GrabbedContent = GrabbedContent {
            grabbed_elements: vec![],
        };
        let mut ranges = vec![];
        let mut from_pos: u64 = 0;
        let mut to_pos: u64 = 0;
        for (i, el) in indexes.iter().enumerate() {
            if i == 0 {
                from_pos = el.index;
            } else if to_pos + 1 != el.index {
                ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
                from_pos = el.index;
            }
            to_pos = el.index;
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from_pos)
            || (ranges.is_empty() && !indexes.is_empty())
        {
            ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
        }
        let mut row: usize = range.start() as usize;
        let grabber = &mut (self.content_grabber.as_ref().ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(String::from("Grabber isn't inited")),
        })?);
        for range in ranges.iter() {
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

    async fn handle_write_session_file(
        &mut self,
        state_cancellation_token: CancellationToken,
        tx_callback_events: UnboundedSender<CallbackEvent>,
        msg: String,
    ) -> Result<bool, NativeError> {
        if self.session_writer.is_none() && self.session_file.is_none() {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(String::from("Session file isn't assigned yet")),
            });
        }
        if self.session_writer.is_none() {
            if let Some(ref session_file) = self.session_file {
                self.session_writer =
                    Some(BufWriter::new(File::create(session_file).map_err(|e| {
                        NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Io,
                            message: Some(format!(
                                "Fail to create session writer for {}: {}",
                                session_file.to_string_lossy(),
                                e
                            )),
                        }
                    })?));
            }
        }
        if let Some(session_writer) = self.session_writer.as_mut() {
            session_writer
                .write(msg.as_bytes())
                .map_err(|e| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Io,
                    message: Some(e.to_string()),
                })?;
            if self.last_message_timestamp.elapsed().as_millis() > NOTIFY_IN_MS {
                session_writer.flush().map_err(|e| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Io,
                    message: Some(e.to_string()),
                })?;
                self.last_message_timestamp = Instant::now();
                return self
                    .handle_update_session(state_cancellation_token, tx_callback_events)
                    .await;
            } else {
                self.session_has_updates = true;
            }
        }
        Ok(false)
    }

    async fn handle_flush_session_file(
        &mut self,
        state_cancellation_token: CancellationToken,
        tx_callback_events: UnboundedSender<CallbackEvent>,
    ) -> Result<(), NativeError> {
        if self.session_writer.is_none() && self.session_file.is_none() {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(String::from("Session file isn't assigned yet")),
            });
        }
        if !self.session_has_updates {
            return Ok(());
        }
        if let Some(session_writer) = self.session_writer.as_mut() {
            session_writer.flush().map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Io,
                message: Some(e.to_string()),
            })?;
            self.last_message_timestamp = Instant::now();
            self.session_has_updates = false;
            self.handle_update_session(state_cancellation_token, tx_callback_events)
                .await?;
        }
        Ok(())
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
                match self
                    .search_holder
                    .execute_search(current, state_cancellation_token)
                {
                    Some(Ok((_processed, mut matches, stats))) => {
                        let found = self.search_map.append(&mut matches) as u64;
                        self.search_map.append_stats(stats);
                        tx_callback_events.send(CallbackEvent::SearchUpdated(found))?;
                        tx_callback_events.send(CallbackEvent::SearchMapUpdated(Some(
                            SearchMap::map_as_str(&matches),
                        )))?;
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

    fn handle_get_search_holder(&mut self, uuid: Uuid) -> Result<SearchHolder, NativeError> {
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
            SearchHolderState::InUse => Err(NativeError::channel("Search holder is in use")),
            SearchHolderState::NotInited => {
                if let Some(session_file) = self.session_file.as_ref() {
                    self.search_holder = SearchHolderState::InUse;
                    Ok(SearchHolder::new(session_file, vec![].iter(), uuid))
                } else {
                    Err(NativeError::channel(
                        "Cannot create search holder without session file.",
                    ))
                }
            }
        }
    }
}

#[derive(Clone, Debug)]
pub struct SessionStateAPI {
    tx_api: UnboundedSender<Api>,
    tracker: OperationTrackerAPI,
    closing_token: CancellationToken,
}

#[allow(clippy::type_complexity)]
impl SessionStateAPI {
    pub fn new(tracker: OperationTrackerAPI) -> (Self, UnboundedReceiver<Api>) {
        let (tx_api, rx_api): (UnboundedSender<Api>, UnboundedReceiver<Api>) = unbounded_channel();
        (
            SessionStateAPI {
                tx_api,
                closing_token: CancellationToken::new(),
                tracker,
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
        self.tx_api.send(api).map_err(|e| {
            NativeError::channel(&format!("Failed to send to Api::{}; error: {}", api_str, e))
        })?;
        rx_response.await.map_err(|_| {
            NativeError::channel(&format!("Failed to get response from Api::{}", api_str))
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

    pub async fn get_nearest_position(
        &self,
        position: u64,
    ) -> Result<Option<NearestPosition>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetNearestPosition((position, tx)), rx)
            .await
    }

    pub async fn get_scaled_map(
        &self,
        dataset_len: u16,
        range: Option<(u64, u64)>,
    ) -> Result<ScaledDistribution, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetScaledMap((dataset_len, range, tx)), rx)
            .await
    }

    pub async fn set_session_file(&self, session_file: SessionFile) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetSessionFile((session_file, tx)), rx)
            .await?
    }

    pub async fn get_session_file(&self) -> Result<PathBuf, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSessionFile(tx), rx).await?
    }

    pub async fn write_session_file(&self, msg: String) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::WriteSessionFile((msg, tx)), rx)
            .await?
    }

    pub async fn flush_session_file(&self) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::FlushSessionFile(tx), rx).await?
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

    pub async fn get_search_holder(&self, uuid: Uuid) -> Result<SearchHolder, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSearchHolder((uuid, tx)), rx)
            .await?
    }

    pub async fn set_search_holder(
        &self,
        holder: Option<SearchHolder>,
        uuid: Uuid,
    ) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetSearchHolder((holder, uuid, tx)), rx)
            .await?
    }

    pub async fn drop_search(&self) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::DropSearch(tx), rx).await
    }

    pub async fn set_matches(
        &self,
        matches: Option<Vec<FilterMatch>>,
        stats: Option<FiltersStats>,
    ) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetMatches((matches, stats, tx)), rx)
            .await
    }

    pub async fn canceling_operation(&self, uuid: Uuid) -> Result<(), NativeError> {
        self.tx_api
            .send(Api::NotifyCancelingOperation(uuid))
            .map_err(|e| {
                NativeError::channel(&format!(
                    "fail to send to Api::NotifyCancelingOperation; error: {}",
                    e,
                ))
            })
    }

    pub async fn canceled_operation(&self, uuid: Uuid) -> Result<(), NativeError> {
        self.tx_api
            .send(Api::NotifyCanceledOperation(uuid))
            .map_err(|e| {
                NativeError::channel(&format!(
                    "Failed to send to Api::NotifyCanceledOperation; error: {}",
                    e,
                ))
            })
    }

    pub async fn close_session(&self) -> Result<(), NativeError> {
        self.closing_token.cancel();
        self.tracker.cancel_all().await?;
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::CloseSession(tx), rx).await
    }

    pub async fn set_debug(&self, debug: bool) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetDebugMode((debug, tx)), rx)
            .await
    }

    pub fn shutdown(&self) -> Result<(), NativeError> {
        self.tx_api.send(Api::Shutdown).map_err(|e| {
            NativeError::channel(&format!("fail to send to Api::Shutdown; error: {}", e,))
        })
    }

    pub fn is_closing(&self) -> bool {
        self.closing_token.is_cancelled()
    }
}

pub async fn run(
    mut rx_api: UnboundedReceiver<Api>,
    tx_callback_events: UnboundedSender<CallbackEvent>,
) -> Result<(), NativeError> {
    let mut state = SessionState {
        session_file: None,
        session_writer: None,
        session_has_updates: false,
        last_message_timestamp: Instant::now(),
        search_map: SearchMap::new(),
        search_holder: SearchHolderState::NotInited,
        content_grabber: None,
        status: Status::Open,
        cancelling_operations: HashMap::new(),
        debug: false,
    };
    let state_cancellation_token = CancellationToken::new();
    debug!("task is started");
    while let Some(msg) = rx_api.recv().await {
        match msg {
            Api::SetSessionFile((session_file, tx_response)) => {
                let res = state.handle_set_session_file(session_file);
                tx_response.send(res).map_err(|_| {
                    NativeError::channel("Failed to response to Api::SetSessionFile")
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
                tx_response.send(res).map_err(|_| {
                    NativeError::channel("Failed to respond to Api::GetSessionFile")
                })?;
            }
            Api::WriteSessionFile((msg, tx_response)) => {
                let res = state
                    .handle_write_session_file(
                        state_cancellation_token.clone(),
                        tx_callback_events.clone(),
                        msg,
                    )
                    .await;
                tx_response.send(res).map_err(|_| {
                    NativeError::channel("Failed to respond to Api::WriteSessionFile")
                })?;
            }
            Api::FlushSessionFile(tx_response) => {
                let res = state
                    .handle_flush_session_file(
                        state_cancellation_token.clone(),
                        tx_callback_events.clone(),
                    )
                    .await;
                tx_response.send(res).map_err(|_| {
                    NativeError::channel("Failed to respond to Api::WriteSessionFile")
                })?;
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
                    .map_err(|_| NativeError::channel("Failed to respond to Api::UpdateSession"))?;
            }
            Api::Grab((range, tx_response)) => {
                let result = if let Some(ref mut grabber) = state.content_grabber {
                    if let Ok(content) = grabber.grab_content(&range) {
                        Ok(content)
                    } else {
                        Err(NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::Grabber,
                            message: Some(String::from("Failed to grab content")),
                        })
                    }
                } else {
                    Err(NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Grabber,
                        message: Some(String::from("Grabber isn't inited")),
                    })
                };
                tx_response
                    .send(result)
                    .map_err(|_| NativeError::channel("Failed to respond to Api::Grab"))?;
            }
            Api::GrabSearch((range, tx_response)) => {
                tx_response
                    .send(state.handle_grab_search(range))
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::GrabbedContent")
                    })?;
            }
            Api::GetNearestPosition((position, tx_response)) => {
                tx_response
                    .send(state.search_map.nearest_to(position))
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::GetNearestPosition")
                    })?;
            }
            Api::GetScaledMap((len, range, tx_response)) => {
                tx_response
                    .send(state.search_map.scaled(len, range))
                    .map_err(|_| NativeError::channel("Failed to respond to Api::GetScaledMap"))?;
            }
            Api::FileRead(tx_response) => {
                tx_callback_events.send(CallbackEvent::FileRead)?;
                tx_response
                    .send(())
                    .map_err(|_| NativeError::channel("Failed to respond to Api::FileRead"))?;
            }
            Api::SetStreamLen((len, tx_response)) => {
                state.search_map.set_stream_len(len);
                tx_response
                    .send(())
                    .map_err(|_| NativeError::channel("Failed to respond to Api::SetStreamLen"))?;
            }
            Api::GetStreamLen(tx_response) => {
                tx_response
                    .send(state.handle_get_stream_len())
                    .map_err(|_| NativeError::channel("Failed to respond to Api::GetStreamLen"))?;
            }
            Api::GetSearchResultLen(tx_response) => {
                tx_response.send(state.search_map.len()).map_err(|_| {
                    NativeError::channel("Failed to respond to Api::GetSearchResultLen")
                })?;
            }
            Api::GetSearchHolder((uuid, tx_response)) => {
                tx_response
                    .send(state.handle_get_search_holder(uuid))
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::GetSearchHolder")
                    })?;
            }
            Api::SetSearchHolder((mut search_holder, _uuid_for_debug, tx_response)) => {
                let result = if matches!(state.search_holder, SearchHolderState::InUse) {
                    if let Some(search_holder) = search_holder.take() {
                        state.search_holder = SearchHolderState::Available(search_holder);
                    } else {
                        state.search_holder = SearchHolderState::NotInited;
                    }
                    Ok(())
                } else {
                    Err(NativeError::channel(
                        "Cannot set search holder - it wasn't in use",
                    ))
                };
                tx_response.send(result).map_err(|_| {
                    NativeError::channel("Failed to respond to Api::SetSearchHolder")
                })?;
            }
            Api::DropSearch(tx_response) => {
                let result = if matches!(state.search_holder, SearchHolderState::InUse) {
                    false
                } else {
                    state.search_holder = SearchHolderState::NotInited;
                    state.search_map.set(None, None);
                    true
                };
                tx_callback_events.send(CallbackEvent::SearchUpdated(0))?;
                tx_callback_events.send(CallbackEvent::SearchMapUpdated(None))?;
                tx_response
                    .send(result)
                    .map_err(|_| NativeError::channel("Failed to respond to Api::DropSearch"))?;
            }
            Api::SetMatches((matches, stats, tx_response)) => {
                let update = matches
                    .as_ref()
                    .map(|matches| SearchMap::map_as_str(matches));
                state.search_map.set(matches, stats);
                tx_callback_events.send(CallbackEvent::SearchMapUpdated(update))?;
                tx_callback_events
                    .send(CallbackEvent::SearchUpdated(state.search_map.len() as u64))?;
                tx_response
                    .send(())
                    .map_err(|_| NativeError::channel("Failed to respond to Api::SetMatches"))?;
            }
            Api::CloseSession(tx_response) => {
                state_cancellation_token.cancel();
                state.status = Status::Closed;
                // Note: all operations would be canceled in close_session of API. We cannot do it here,
                // because we would lock this loop if some operation needs access to state during cancellation.
                if tx_response.send(()).is_err() {
                    return Err(NativeError::channel(
                        "fail to response to Api::CloseSession",
                    ));
                }
            }
            Api::SetDebugMode((debug, tx_response)) => {
                state.debug = debug;
                if tx_response.send(()).is_err() {
                    return Err(NativeError::channel(
                        "fail to response to Api::SetDebugMode",
                    ));
                }
            }
            Api::NotifyCancelingOperation(uuid) => {
                state.cancelling_operations.insert(uuid, true);
            }
            Api::NotifyCanceledOperation(uuid) => {
                state.cancelling_operations.remove(&uuid);
            }
            Api::Shutdown => {
                state_cancellation_token.cancel();
                debug!("shutdown has been requested");
                break;
            }
        }
    }
    if state.session_writer.is_some() {
        if let Some(session_file) = state.session_file.take() {
            debug!("cleaning up files: {:?}", session_file);
            if session_file.exists() {
                std::fs::remove_file(session_file).map_err(|e| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Io,
                    message: Some(e.to_string()),
                })?;
            }
        }
    }
    debug!("task is finished");
    Ok(())
}
