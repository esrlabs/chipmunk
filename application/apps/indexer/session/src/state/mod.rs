use crate::{
    events::{CallbackEvent, NativeError, NativeErrorKind},
    tracker::OperationTrackerAPI,
};
use indexer_base::progress::Severity;
use log::{debug, error};
use processor::{
    grabber::LineRange,
    map::{FilterMatch, FiltersStats, NearestPosition, ScaledDistribution, SearchMap},
    search::{SearchHolder, SearchResults},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fmt::Display,
    fs::File,
    io::{BufWriter, Write},
    path::PathBuf,
};
use tokio::sync::{
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    oneshot,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

mod observing;
mod session_file;

pub use observing::SourceDefinition;
pub use session_file::{SessionFile, SessionFileState};

pub const NOTIFY_IN_MS: u128 = 250;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GrabbedElement {
    #[serde(rename = "id")]
    pub source_id: u8,
    #[serde(rename = "c")]
    pub content: String,
    #[serde(rename = "r")]
    pub row: usize,
    #[serde(rename = "p")]
    pub pos: usize,
}

#[derive(Debug)]
pub enum SearchHolderState {
    Available(SearchHolder),
    InUse,
    NotInited,
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
    SetSessionFile((Option<PathBuf>, oneshot::Sender<Result<(), NativeError>>)),
    GetSessionFile(oneshot::Sender<Result<PathBuf, NativeError>>),
    WriteSessionFile((u8, String, oneshot::Sender<Result<(), NativeError>>)),
    FlushSessionFile(oneshot::Sender<Result<(), NativeError>>),
    UpdateSession((u8, oneshot::Sender<Result<bool, NativeError>>)),
    AddSource((String, oneshot::Sender<u8>)),
    GetSourcesDefinitions(oneshot::Sender<Vec<SourceDefinition>>),
    ExportSession {
        out_path: PathBuf,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
        cancel: CancellationToken,
        tx_response: oneshot::Sender<Result<bool, NativeError>>,
    },
    ExportSearch {
        out_path: PathBuf,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
        cancel: CancellationToken,
        tx_response: oneshot::Sender<Result<bool, NativeError>>,
    },
    FileRead(oneshot::Sender<()>),
    Grab(
        (
            LineRange,
            oneshot::Sender<Result<Vec<GrabbedElement>, NativeError>>,
        ),
    ),
    GetStreamLen(oneshot::Sender<usize>),
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
            oneshot::Sender<Result<Vec<GrabbedElement>, NativeError>>,
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
                Self::AddSource(_) => "AddSource",
                Self::GetSourcesDefinitions(_) => "GetSourcesDefinitions",
                Self::ExportSession { .. } => "ExportSession",
                Self::ExportSearch { .. } => "ExportSearch",
                Self::FileRead(_) => "FileRead",
                Self::Grab(_) => "Grab",
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
    pub session_file: SessionFile,
    pub search_map: SearchMap,
    pub search_holder: SearchHolderState,
    pub cancelling_operations: HashMap<Uuid, bool>,
    pub status: Status,
    pub debug: bool,
}

impl SessionState {
    fn handle_grab_search(&mut self, range: LineRange) -> Result<Vec<GrabbedElement>, NativeError> {
        let indexes = self
            .search_map
            .indexes(&range.range)
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!("{}", e)),
            })?;
        let mut elements: Vec<GrabbedElement> = vec![];
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
        for range in ranges.iter() {
            let mut session_elements = self.session_file.grab(&LineRange::from(range.clone()))?;
            let start = *range.start() as usize;
            for (j, element) in session_elements.iter_mut().enumerate() {
                element.pos = start + j;
                element.row = row;
                row += 1;
            }
            elements.append(&mut session_elements);
        }
        Ok(elements)
    }

    async fn handle_write_session_file(
        &mut self,
        source_id: u8,
        state_cancellation_token: CancellationToken,
        tx_callback_events: UnboundedSender<CallbackEvent>,
        msg: String,
    ) -> Result<(), NativeError> {
        if matches!(
            self.session_file
                .write(source_id, state_cancellation_token.clone(), msg)
                .await?,
            SessionFileState::Changed
        ) {
            self.update_search(state_cancellation_token, tx_callback_events)
                .await?;
        }
        Ok(())
    }

    // TODO: do we need bool as output
    async fn handle_flush_session_file(
        &mut self,
        state_cancellation_token: CancellationToken,
        tx_callback_events: UnboundedSender<CallbackEvent>,
    ) -> Result<(), NativeError> {
        if matches!(
            self.session_file
                .flush(state_cancellation_token.clone(),)
                .await?,
            SessionFileState::Changed
        ) {
            self.update_search(state_cancellation_token, tx_callback_events)
                .await?;
        }
        Ok(())
    }

    async fn handle_update_session(
        &mut self,
        source_id: u8,
        state_cancellation_token: CancellationToken,
        tx_callback_events: UnboundedSender<CallbackEvent>,
    ) -> Result<bool, NativeError> {
        if let SessionFileState::Changed = self
            .session_file
            .update(source_id, state_cancellation_token.clone())
            .await?
        {
            self.update_search(state_cancellation_token, tx_callback_events)
                .await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    async fn update_search(
        &mut self,
        state_cancellation_token: CancellationToken,
        tx_callback_events: UnboundedSender<CallbackEvent>,
    ) -> Result<(), NativeError> {
        let len = self.session_file.len() as u64;
        self.search_map.set_stream_len(len);
        tx_callback_events.send(CallbackEvent::StreamUpdated(len))?;
        match self
            .search_holder
            .execute_search(len, state_cancellation_token)
        {
            Some(Ok((_processed, mut matches, stats))) => {
                let found = self.search_map.append(&mut matches) as u64;
                self.search_map.append_stats(stats);
                tx_callback_events.send(CallbackEvent::search_results(
                    found,
                    self.search_map.get_stats(),
                ))?;
                tx_callback_events.send(CallbackEvent::SearchMapUpdated(Some(
                    SearchMap::map_as_str(&matches),
                )))?;
            }
            Some(Err(err)) => error!("Fail to append search: {}", err),
            None => (),
        }
        Ok(())
    }

    async fn handle_export_session(
        &mut self,
        out_path: PathBuf,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
        cancel: CancellationToken,
    ) -> Result<bool, NativeError> {
        let mut writer = BufWriter::new(File::create(&out_path).map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!(
                "Fail to create writer for {}: {}",
                out_path.to_string_lossy(),
                e
            )),
        })?);
        for (i, range) in ranges.iter().enumerate() {
            self.session_file
                .copy_content(&mut writer, &LineRange::from(range.clone()))?;
            if i != ranges.len() - 1 {
                writer.write(b"\n").map_err(|e| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Io,
                    message: Some(format!(
                        "Fail to write to file {}: {}",
                        out_path.to_string_lossy(),
                        e
                    )),
                })?;
            }
            if cancel.is_cancelled() {
                return Ok(false);
            }
        }
        writer.flush().map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!("Fail to write into file: {:?}", e)),
        })?;
        Ok(true)
    }

    async fn handle_export_search(
        &mut self,
        out_path: PathBuf,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
        cancel: CancellationToken,
    ) -> Result<bool, NativeError> {
        let mut indexes: Vec<u64> = self.search_map.matches.iter().map(|el| el.index).collect();
        for range in ranges.iter() {
            (*range.start()..=*range.end()).for_each(|i| {
                if !indexes.iter().any(|s| s == &i) {
                    indexes.push(i);
                }
            });
        }
        indexes.sort_unstable();
        let mut ranges = vec![];
        let mut from_pos: u64 = 0;
        let mut to_pos: u64 = 0;
        for (i, index) in indexes.iter().enumerate() {
            if i == 0 {
                from_pos = *index;
            } else if to_pos + 1 != *index {
                ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
                from_pos = *index;
            }
            to_pos = *index;
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from_pos)
            || (ranges.is_empty() && !indexes.is_empty())
        {
            ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
        }
        let mut writer = BufWriter::new(File::create(&out_path).map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!(
                "Fail to create writer for {}: {}",
                out_path.to_string_lossy(),
                e
            )),
        })?);
        for (i, range) in ranges.iter().enumerate() {
            self.session_file
                .copy_content(&mut writer, &LineRange::from(range.clone()))?;
            if i != ranges.len() - 1 {
                writer.write(b"\n").map_err(|e| NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Io,
                    message: Some(format!(
                        "Fail to write to file {}: {}",
                        out_path.to_string_lossy(),
                        e
                    )),
                })?;
            }
            if cancel.is_cancelled() {
                return Ok(false);
            }
        }
        writer.flush().map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!("Fail to write into file: {:?}", e)),
        })?;
        Ok(true)
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
                let filename = self.session_file.filename()?;
                self.search_holder = SearchHolderState::InUse;
                Ok(SearchHolder::new(&filename, vec![].iter(), uuid))
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

    pub async fn grab(&self, range: LineRange) -> Result<Vec<GrabbedElement>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::Grab((range.clone(), tx)), rx)
            .await?
    }

    pub async fn grab_search(&self, range: LineRange) -> Result<Vec<GrabbedElement>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GrabSearch((range, tx)), rx)
            .await?
    }

    pub async fn get_stream_len(&self) -> Result<usize, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetStreamLen(tx), rx).await
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

    pub async fn set_session_file(&self, filename: Option<PathBuf>) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::SetSessionFile((filename, tx)), rx)
            .await?
    }

    pub async fn get_session_file(&self) -> Result<PathBuf, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSessionFile(tx), rx).await?
    }

    pub async fn write_session_file(&self, source_id: u8, msg: String) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::WriteSessionFile((source_id, msg, tx)), rx)
            .await?
    }

    pub async fn flush_session_file(&self) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::FlushSessionFile(tx), rx).await?
    }

    pub async fn update_session(&self, source_id: u8) -> Result<bool, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::UpdateSession((source_id, tx)), rx)
            .await?
    }

    pub async fn add_source(&self, uuid: &str) -> Result<u8, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::AddSource((uuid.to_owned(), tx)), rx)
            .await
    }

    pub async fn get_sources_definitions(&self) -> Result<Vec<SourceDefinition>, NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::GetSourcesDefinitions(tx), rx)
            .await
    }

    pub async fn export_session(
        &self,
        out_path: PathBuf,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
        cancel: CancellationToken,
    ) -> Result<bool, NativeError> {
        let (tx_response, rx) = oneshot::channel();
        self.exec_operation(
            Api::ExportSession {
                out_path,
                ranges,
                tx_response,
                cancel,
            },
            rx,
        )
        .await?
    }

    pub async fn export_search(
        &self,
        out_path: PathBuf,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
        cancel: CancellationToken,
    ) -> Result<bool, NativeError> {
        let (tx_response, rx) = oneshot::channel();
        self.exec_operation(
            Api::ExportSearch {
                out_path,
                ranges,
                tx_response,
                cancel,
            },
            rx,
        )
        .await?
    }

    pub async fn file_read(&self) -> Result<(), NativeError> {
        let (tx, rx) = oneshot::channel();
        self.exec_operation(Api::FileRead(tx), rx).await
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
        session_file: SessionFile::new(),
        search_map: SearchMap::new(),
        search_holder: SearchHolderState::NotInited,
        status: Status::Open,
        cancelling_operations: HashMap::new(),
        debug: false,
    };
    let state_cancellation_token = CancellationToken::new();
    debug!("task is started");
    while let Some(msg) = rx_api.recv().await {
        match msg {
            Api::SetSessionFile((session_file, tx_response)) => {
                tx_response
                    .send(state.session_file.init(session_file))
                    .map_err(|_| {
                        NativeError::channel("Failed to response to Api::SetSessionFile")
                    })?;
            }
            Api::GetSessionFile(tx_response) => {
                tx_response
                    .send(state.session_file.filename())
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::GetSessionFile")
                    })?;
            }
            Api::WriteSessionFile((source_id, msg, tx_response)) => {
                tx_response
                    .send(
                        state
                            .handle_write_session_file(
                                source_id,
                                state_cancellation_token.clone(),
                                tx_callback_events.clone(),
                                msg,
                            )
                            .await,
                    )
                    .map_err(|_| {
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
            Api::UpdateSession((source_id, tx_response)) => {
                let res = state
                    .handle_update_session(
                        source_id,
                        state_cancellation_token.clone(),
                        tx_callback_events.clone(),
                    )
                    .await;
                tx_response
                    .send(res)
                    .map_err(|_| NativeError::channel("Failed to respond to Api::UpdateSession"))?;
            }
            Api::AddSource((uuid, tx_response)) => {
                tx_response
                    .send(state.session_file.observing.add_source(uuid))
                    .map_err(|_| NativeError::channel("Failed to respond to Api::AddSource"))?;
            }
            Api::GetSourcesDefinitions(tx_response) => {
                tx_response
                    .send(state.session_file.observing.get_sources_definitions())
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::GetSourcesDefinitions")
                    })?;
            }
            Api::ExportSession {
                out_path,
                ranges,
                cancel,
                tx_response,
            } => {
                let res = state.handle_export_session(out_path, ranges, cancel).await;
                tx_response
                    .send(res)
                    .map_err(|_| NativeError::channel("Failed to respond to Api::ExportSession"))?;
            }
            Api::ExportSearch {
                out_path,
                ranges,
                cancel,
                tx_response,
            } => {
                let res = state.handle_export_search(out_path, ranges, cancel).await;
                tx_response
                    .send(res)
                    .map_err(|_| NativeError::channel("Failed to respond to Api::ExportSearch"))?;
            }
            Api::Grab((range, tx_response)) => {
                tx_response
                    .send(state.session_file.grab(&range))
                    .map_err(|_| NativeError::channel("Failed to respond to Api::Grab"))?;
            }
            Api::GrabSearch((range, tx_response)) => {
                tx_response
                    .send(state.handle_grab_search(range))
                    .map_err(|_| NativeError::channel("Failed to respond to Api::GrabSearch"))?;
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
            Api::GetStreamLen(tx_response) => {
                tx_response
                    .send(state.session_file.len())
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
                tx_callback_events.send(CallbackEvent::no_search_results())?;
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
                tx_callback_events.send(CallbackEvent::search_results(
                    state.search_map.len() as u64,
                    state.search_map.get_stats(),
                ))?;
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
    state.session_file.cleanup()?;
    debug!("task is finished");
    Ok(())
}
