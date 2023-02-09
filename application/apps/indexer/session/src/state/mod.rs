use crate::events::{CallbackEvent, NativeError, NativeErrorKind};
use indexer_base::progress::Severity;
use log::{debug, error};
use processor::{grabber::LineRange, map::SearchMap, search};
use std::{
    collections::HashMap,
    fs::File,
    io::{BufWriter, Write},
    ops::RangeInclusive,
    path::PathBuf,
};
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

mod api;
mod indexes;
mod observed;
mod searchers;
mod session_file;
mod source_ids;

pub use api::{Api, SessionStateAPI};
pub use indexes::{
    controller::{Controller as Indexes, Mode as IndexesMode},
    frame::Frame,
    map::Map,
    nature::Nature,
};
use observed::Observed;
use searchers::{SearcherState, Searchers};
pub use session_file::{GrabbedElement, SessionFile, SessionFileState};
pub use source_ids::SourceDefinition;

#[derive(Debug)]
pub enum Status {
    Open,
    Closed,
}

#[derive(Debug)]
pub struct SessionState {
    pub session_file: SessionFile,
    pub observed: Observed,
    pub search_map: SearchMap,
    pub indexes: Indexes,
    pub searchers: Searchers,
    pub cancelling_operations: HashMap<Uuid, bool>,
    pub status: Status,
    pub debug: bool,
}

impl SessionState {
    fn new(tx_callback_events: UnboundedSender<CallbackEvent>) -> Self {
        Self {
            session_file: SessionFile::new(),
            observed: Observed::new(),
            search_map: SearchMap::new(),
            searchers: Searchers {
                regular: SearcherState::NotInited,
                values: SearcherState::NotInited,
            },
            indexes: Indexes::new(Some(tx_callback_events)),
            status: Status::Open,
            cancelling_operations: HashMap::new(),
            debug: false,
        }
    }

    fn handle_grab(&mut self, range: &LineRange) -> Result<Vec<GrabbedElement>, NativeError> {
        let mut elements = self.session_file.grab(range)?;
        self.indexes.naturalize(&mut elements);
        Ok(elements)
    }

    fn handle_grab_indexed(
        &mut self,
        mut range: RangeInclusive<u64>,
    ) -> Result<Vec<GrabbedElement>, NativeError> {
        let frame = self.indexes.frame(&mut range)?;
        let mut elements: Vec<GrabbedElement> = vec![];
        for range in frame.ranges().iter() {
            let mut session_elements = self.session_file.grab(&LineRange::from(range.clone()))?;
            elements.append(&mut session_elements);
        }
        frame.naturalize(&mut elements)?;
        Ok(elements)
    }

    fn handle_grab_search(&mut self, range: LineRange) -> Result<Vec<GrabbedElement>, NativeError> {
        let indexes = self
            .search_map
            .indexes(&range.range)
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!("{e}")),
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
        for range in ranges.iter() {
            let mut session_elements = self.session_file.grab(&LineRange::from(range.clone()))?;
            elements.append(&mut session_elements);
        }
        self.indexes.naturalize(&mut elements);
        Ok(elements)
    }

    fn handle_grab_ranges(
        &mut self,
        ranges: Vec<RangeInclusive<u64>>,
    ) -> Result<Vec<GrabbedElement>, NativeError> {
        let mut elements: Vec<GrabbedElement> = vec![];
        for range in ranges.iter() {
            let mut session_elements = self.session_file.grab(&LineRange::from(range.clone()))?;
            elements.append(&mut session_elements);
        }
        self.indexes.naturalize(&mut elements);
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
        let rows = self.session_file.len();
        let bytes = self.session_file.read_bytes();
        self.search_map.set_stream_len(rows);
        self.indexes.set_stream_len(rows)?;
        tx_callback_events.send(CallbackEvent::StreamUpdated(rows))?;
        match self
            .searchers
            .regular
            .search(rows, bytes, state_cancellation_token)
        {
            Some(Ok((_processed, mut matches, stats))) => {
                self.indexes.append_search_results(&matches)?;
                let map_updates = SearchMap::map_as_str(&matches);
                let found = self.search_map.append(&mut matches) as u64;
                self.search_map.append_stats(stats);
                tx_callback_events.send(CallbackEvent::search_results(
                    found,
                    self.search_map.get_stats(),
                ))?;
                tx_callback_events.send(CallbackEvent::SearchMapUpdated(Some(map_updates)))?;
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
            message: Some(format!("Fail to write into file: {e:?}")),
        })?;
        Ok(true)
    }

    fn handle_get_search_holder(
        &mut self,
        uuid: Uuid,
    ) -> Result<search::searchers::regular::Searcher, NativeError> {
        match self.searchers.regular {
            SearcherState::Available(_) => {
                use std::mem;
                if let SearcherState::Available(holder) =
                    mem::replace(&mut self.searchers.regular, SearcherState::InUse)
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
            SearcherState::InUse => Err(NativeError::channel("Search holder is in use")),
            SearcherState::NotInited => {
                let filename = self.session_file.filename()?;
                self.searchers.regular = SearcherState::InUse;
                Ok(search::searchers::regular::Searcher::new(
                    &filename,
                    vec![].iter(),
                    uuid,
                ))
            }
        }
    }
}

pub async fn run(
    mut rx_api: UnboundedReceiver<Api>,
    tx_callback_events: UnboundedSender<CallbackEvent>,
) -> Result<(), NativeError> {
    let mut state = SessionState::new(tx_callback_events.clone());
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
                    .send(state.session_file.sources.add_source(uuid))
                    .map_err(|_| NativeError::channel("Failed to respond to Api::AddSource"))?;
            }
            Api::GetSourcesDefinitions(tx_response) => {
                tx_response
                    .send(state.session_file.sources.get_sources_definitions())
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::GetSourcesDefinitions")
                    })?;
            }
            Api::AddExecutedObserve((options, tx_response)) => {
                state.observed.add(options);
                tx_response.send(()).map_err(|_| {
                    NativeError::channel("Failed to respond to Api::AddExecutedObserve")
                })?;
            }
            Api::GetExecutedHolder(tx_response) => {
                tx_response.send(state.observed.clone()).map_err(|_| {
                    NativeError::channel("Failed to respond to Api::GetExecutedHolder")
                })?;
            }
            Api::IsRawExportAvailable(tx_response) => {
                tx_response
                    .send(state.observed.is_file_based_export_possible())
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::IsRawExportAvailable")
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
            Api::Grab((range, tx_response)) => {
                tx_response
                    .send(state.handle_grab(&range))
                    .map_err(|_| NativeError::channel("Failed to respond to Api::Grab"))?;
            }
            Api::GrabIndexed((range, tx_response)) => {
                tx_response
                    .send(state.handle_grab_indexed(range))
                    .map_err(|_| NativeError::channel("Failed to respond to Api::GrabIndexed"))?;
            }
            Api::SetIndexingMode((mode, tx_response)) => {
                tx_response
                    .send(state.indexes.set_mode(mode))
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::SetIndexingMode")
                    })?;
            }
            Api::GetIndexedMapLen(tx_response) => {
                tx_response.send(state.indexes.len()).map_err(|_| {
                    NativeError::channel("Failed to respond to Api::GetIndexedMapLen")
                })?;
            }
            Api::GetDistancesAroundIndex((position, tx_response)) => {
                tx_response
                    .send(state.indexes.get_around_indexes(&position))
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::GetIndexedMapLen")
                    })?;
            }
            Api::AddBookmark((row, tx_response)) => {
                tx_response
                    .send(state.indexes.add_bookmark(row))
                    .map_err(|_| NativeError::channel("Failed to respond to Api::AddBookmark"))?;
            }
            Api::SetBookmarks((rows, tx_response)) => {
                tx_response
                    .send(state.indexes.set_bookmarks(rows))
                    .map_err(|_| NativeError::channel("Failed to respond to Api::SetBookmarks"))?;
            }
            Api::RemoveBookmark((row, tx_response)) => {
                tx_response
                    .send(state.indexes.remove_bookmark(row))
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::RemoveBookmark")
                    })?;
            }
            Api::ExpandBreadcrumbs {
                seporator,
                offset,
                above,
                tx_response,
            } => {
                tx_response
                    .send(state.indexes.breadcrumbs_expand(seporator, offset, above))
                    .map_err(|_| {
                        NativeError::channel("Failed to respond to Api::ExpandBreadcrumbs")
                    })?;
            }
            Api::GrabSearch((range, tx_response)) => {
                tx_response
                    .send(state.handle_grab_search(range))
                    .map_err(|_| NativeError::channel("Failed to respond to Api::GrabSearch"))?;
            }
            Api::GrabRanges((ranges, tx_response)) => {
                tx_response
                    .send(state.handle_grab_ranges(ranges))
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
                    .send((state.session_file.len(), state.session_file.read_bytes()))
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
                let result = if matches!(state.searchers.regular, SearcherState::InUse) {
                    if let Some(search_holder) = search_holder.take() {
                        state.searchers.regular = SearcherState::Available(search_holder);
                    } else {
                        state.searchers.regular = SearcherState::NotInited;
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
                let result = if matches!(state.searchers.regular, SearcherState::InUse) {
                    false
                } else {
                    state.searchers.regular = SearcherState::NotInited;
                    state.search_map.set(None, None);
                    state.indexes.drop_search()?;
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
                if let Some(matches) = matches.as_ref() {
                    state.indexes.set_search_results(matches)?;
                }
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
