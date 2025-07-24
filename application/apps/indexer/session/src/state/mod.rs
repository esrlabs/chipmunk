use log::{debug, error};
use processor::{
    grabber::LineRange,
    map::SearchMap,
    search::{
        filter::SearchFilter,
        searchers::{
            linear::LineSearcher, regular::RegularSearchHolder, values::ValueSearchHolder,
        },
    },
};
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
pub(crate) mod attachments;
mod indexes;
mod observed;
mod searchers;
mod session_file;
mod source_ids;
pub(crate) mod values;

pub use api::{Api, SessionStateAPI};
pub use attachments::{Attachments, AttachmentsError};
pub use indexes::{
    controller::{Controller as Indexes, Mode as IndexesMode},
    frame::Frame,
    map::Map,
    nature::Nature,
};
use observed::Observed;
use searchers::{SearcherState, Searchers};
pub use session_file::{SessionFile, SessionFileOrigin, SessionFileState};
use stypes::{FilterMatch, GrabbedElement};
pub use values::{Values, ValuesError};

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
    pub values: Values,
    pub searchers: Searchers,
    pub attachments: Attachments,
    pub cancelling_operations: HashMap<Uuid, bool>,
    pub status: Status,
    pub debug: bool,
}

impl SessionState {
    fn new(tx_callback_events: UnboundedSender<stypes::CallbackEvent>) -> Self {
        Self {
            session_file: SessionFile::new(),
            observed: Observed::new(),
            search_map: SearchMap::new(),
            searchers: Searchers {
                regular: SearcherState::NotInited,
                values: SearcherState::NotInited,
            },
            attachments: Attachments::new(),
            indexes: Indexes::new(Some(tx_callback_events.clone())),
            values: Values::new(Some(tx_callback_events)),
            status: Status::Open,
            cancelling_operations: HashMap::new(),
            debug: false,
        }
    }

    fn handle_grab(
        &mut self,
        range: &LineRange,
    ) -> Result<Vec<GrabbedElement>, stypes::NativeError> {
        let mut elements = self.session_file.grab(range)?;
        self.indexes.naturalize(&mut elements);
        Ok(elements)
    }

    fn handle_grab_indexed(
        &mut self,
        mut range: RangeInclusive<u64>,
    ) -> Result<Vec<GrabbedElement>, stypes::NativeError> {
        let frame = self.indexes.frame(&mut range)?;
        let mut elements: Vec<GrabbedElement> = vec![];
        for range in frame.ranges().iter() {
            let mut session_elements = self.session_file.grab(&LineRange::from(range.clone()))?;
            elements.append(&mut session_elements);
        }
        frame.naturalize(&mut elements)?;
        Ok(elements)
    }

    /// Transforms search match data into ranges of line numbers in the original session file.
    ///
    /// This function is used to retrieve the line number ranges in the session file based on the
    /// search results. These ranges are necessary for reading data related to the search results.
    ///
    /// # Parameters
    ///
    /// * `search_indexes` - A slice of `FilterMatch` instances containing information about search matches.
    ///
    /// # Returns
    ///
    /// * `Vec<RangeInclusive<u64>>` - A vector of inclusive ranges representing line numbers in the session file.
    fn transform_indexes(&self, search_indexes: &[FilterMatch]) -> Vec<RangeInclusive<u64>> {
        let mut ranges = vec![];
        let mut from_pos: u64 = 0;
        let mut to_pos: u64 = 0;
        for (i, el) in search_indexes.iter().enumerate() {
            if i == 0 {
                from_pos = el.index;
            } else if to_pos + 1 != el.index {
                ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
                from_pos = el.index;
            }
            to_pos = el.index;
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from_pos)
            || (ranges.is_empty() && !search_indexes.is_empty())
        {
            ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
        }
        ranges
    }

    fn handle_grab_search(
        &mut self,
        range: LineRange,
    ) -> Result<Vec<GrabbedElement>, stypes::NativeError> {
        let indexes = self
            .search_map
            .indexes(&range.range)
            .map_err(|e| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!("{e}")),
            })?;
        let mut elements: Vec<GrabbedElement> = vec![];
        for range in self.transform_indexes(indexes).iter() {
            let mut session_elements = self.session_file.grab(&LineRange::from(range.clone()))?;
            elements.append(&mut session_elements);
        }
        self.indexes.naturalize(&mut elements);
        Ok(elements)
    }

    /// Handles "nested" search functionality.
    /// A "nested" search refers to filtering matches within the primary search results.
    ///
    /// # Parameters
    ///
    /// * `filter` - The search filter used to specify the criteria for the nested search.
    /// * `from` - The starting position (within the primary search results) for the nested search.
    /// * `rev` - Specifies the direction of the search:
    ///     * `true` - Perform the search in reverse.
    ///     * `false` - Perform the search in forward order.
    ///
    /// # Process
    ///
    /// 1. Starting from the `from` position, determine the ranges of lines in the original session file
    ///    that correspond to the primary search results.
    /// 2. Create a line-based search utility (`LineSearcher`) using the provided `filter`.
    /// 3. Iterate through each range, reading and checking lines for matches.
    /// 4. Stop the search as soon as a match is found and return the result.
    ///
    /// # Returns
    ///
    /// If a match is found:
    /// * `Some((search_result_line_index, session_file_line_index))` - A tuple containing:
    ///     - The line index within the search results.
    ///     - The corresponding line index in the session file.
    ///
    /// If no match is found:
    /// * `None`
    ///
    /// On error:
    /// * `Err(stypes::NativeError)` - Describes the error encountered during the process.
    fn handle_search_nested_match(
        &mut self,
        filter: SearchFilter,
        from: u64,
        rev: bool,
    ) -> Result<Option<(u64, u64)>, stypes::NativeError> {
        let indexes = if !rev {
            self.search_map.indexes_from(from)
        } else {
            self.search_map.indexes_to_rev(from)
        }
        .map_err(|e| stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Grabber,
            message: Some(format!("{e}")),
        })?;
        let searcher = LineSearcher::new(&filter).map_err(|e| stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::OperationSearch,
            message: Some(e.to_string()),
        })?;
        let mut indexes: std::vec::IntoIter<RangeInclusive<u64>> =
            self.transform_indexes(indexes).into_iter();
        while let Some(range) = if !rev {
            indexes.next()
        } else {
            indexes.next_back()
        } {
            let grabbed = self.session_file.grab(&LineRange::from(range.clone()))?;
            let found = if !rev {
                grabbed.iter().find(|ln| searcher.is_match(&ln.content))
            } else {
                grabbed
                    .iter()
                    .rev()
                    .find(|ln| searcher.is_match(&ln.content))
            };
            if let Some(ln) = found {
                let Some(srch_pos) = self.search_map.get_match_index(ln.pos as u64) else {
                    return Err(stypes::NativeError {
                        severity: stypes::Severity::ERROR,
                        kind: stypes::NativeErrorKind::OperationSearch,
                        message: Some(format!(
                            "Fail to find search index of stream position {}",
                            ln.pos
                        )),
                    });
                };
                return Ok(Some((ln.pos as u64, srch_pos)));
            };
        }
        Ok(None)
    }

    fn handle_grab_ranges(
        &mut self,
        ranges: Vec<RangeInclusive<u64>>,
    ) -> Result<Vec<GrabbedElement>, stypes::NativeError> {
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
        source_id: u16,
        state_cancellation_token: CancellationToken,
        tx_callback_events: UnboundedSender<stypes::CallbackEvent>,
        msg: String,
    ) -> Result<(), stypes::NativeError> {
        if matches!(
            self.session_file
                .write(source_id, state_cancellation_token.clone(), msg)?,
            SessionFileState::Changed
        ) {
            self.update_searchers(state_cancellation_token, tx_callback_events)
                .await?;
        }
        Ok(())
    }

    // TODO: do we need bool as output
    async fn handle_flush_session_file(
        &mut self,
        state_cancellation_token: CancellationToken,
        tx_callback_events: UnboundedSender<stypes::CallbackEvent>,
    ) -> Result<(), stypes::NativeError> {
        if matches!(
            self.session_file
                .flush(state_cancellation_token.clone(), true)?,
            SessionFileState::Changed
        ) {
            self.update_searchers(state_cancellation_token, tx_callback_events)
                .await?;
        }
        Ok(())
    }

    async fn handle_update_session(
        &mut self,
        source_id: u16,
        state_cancellation_token: CancellationToken,
        tx_callback_events: UnboundedSender<stypes::CallbackEvent>,
    ) -> Result<bool, stypes::NativeError> {
        if let SessionFileState::Changed = self
            .session_file
            .update(source_id, state_cancellation_token.clone())?
        {
            self.update_searchers(state_cancellation_token, tx_callback_events)
                .await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    async fn update_searchers(
        &mut self,
        state_cancellation_token: CancellationToken,
        tx_callback_events: UnboundedSender<stypes::CallbackEvent>,
    ) -> Result<(), stypes::NativeError> {
        let rows = self.session_file.len();
        let bytes = self.session_file.read_bytes();
        self.search_map.set_stream_len(rows);
        self.indexes.set_stream_len(rows)?;
        tx_callback_events.send(stypes::CallbackEvent::StreamUpdated(rows))?;
        match self
            .searchers
            .regular
            .search(rows, bytes, state_cancellation_token.clone())
        {
            Some(Ok((_processed, mut matches, stats))) => {
                self.indexes.append_search_results(&matches)?;
                let updates: stypes::FilterMatchList = (&matches).into();
                let found = self.search_map.append(&mut matches) as u64;
                self.search_map.append_stats(stats);
                tx_callback_events.send(stypes::CallbackEvent::search_results(
                    found,
                    self.search_map.get_stats(),
                ))?;
                tx_callback_events.send(stypes::CallbackEvent::SearchMapUpdated(Some(updates)))?;
            }
            Some(Err(err)) => error!("Fail to append search: {err}"),
            None => (),
        }
        match self
            .searchers
            .values
            .search(rows, bytes, state_cancellation_token)
        {
            Some(Ok((_processed, values))) => {
                self.values.append_values(values);
            }
            Some(Err(err)) => error!("Fail to update search values: {err}"),
            None => (),
        }
        Ok(())
    }

    /// Exports data to the specified output path with the given parameters. This method is used to export
    /// only into text format.
    ///
    /// # Arguments
    ///
    /// * `out_path` - A `PathBuf` representing the path to the output file where data will be exported.
    /// * `ranges` - A `Vec<RangeInclusive<u64>>` specifying the ranges of data to export.
    /// * `columns` - A `Vec<usize>` containing the column number to be exported.
    /// * `spliter` - A `String` used as the record separator in session file to split log message to columns.
    /// * `delimiter` - A `String` used as the field delimiter within each record in output file.
    /// * `cancel` - A `CancellationToken` used to cancel exporting operation
    ///
    /// # Returns
    ///
    /// * `Result<bool, stypes::NativeError>`:
    ///     - `Ok(true)` if the export is successful.
    ///     - `Ok(false)` if the export was stopped with `cancel`.
    ///     - `Err(stypes::NativeError)` if an error occurs during the export process.
    ///
    async fn handle_export_session(
        &mut self,
        out_path: PathBuf,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
        columns: Vec<usize>,
        spliter: Option<String>,
        delimiter: Option<String>,
        cancel: CancellationToken,
    ) -> Result<bool, stypes::NativeError> {
        let mut writer =
            BufWriter::new(File::create(&out_path).map_err(|e| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Io,
                message: Some(format!(
                    "Fail to create writer for {}: {}",
                    out_path.to_string_lossy(),
                    e
                )),
            })?);
        for (i, range) in ranges.iter().enumerate() {
            let modifier =
                if let (Some(spliter), Some(delimiter)) = (spliter.as_ref(), delimiter.as_ref()) {
                    Some(|s: String| {
                        s.split(spliter.as_str())
                            .enumerate()
                            .filter(|(n, _)| columns.contains(n))
                            .map(|(_, s)| s)
                            .collect::<Vec<&str>>()
                            .join(delimiter.as_str())
                    })
                } else {
                    None
                };
            self.session_file.copy_content(
                &mut writer,
                &LineRange::from(range.clone()),
                modifier,
            )?;
            if i != ranges.len() - 1 {
                writer.write(b"\n").map_err(|e| stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Io,
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
        writer.flush().map_err(|e| stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Io,
            message: Some(format!("Fail to write into file: {e:?}")),
        })?;
        Ok(true)
    }

    fn handle_get_search_holder(
        &mut self,
        uuid: Uuid,
    ) -> Result<RegularSearchHolder, stypes::NativeError> {
        match self.searchers.regular {
            SearcherState::Available(_) => {
                use std::mem;
                if let SearcherState::Available(holder) =
                    mem::replace(&mut self.searchers.regular, SearcherState::InUse)
                {
                    Ok(holder)
                } else {
                    Err(stypes::NativeError {
                        severity: stypes::Severity::ERROR,
                        kind: stypes::NativeErrorKind::Configuration,
                        message: Some(String::from("Could not replace search holder in state")),
                    })
                }
            }
            SearcherState::InUse => Err(stypes::NativeError::channel("Search holder is in use")),
            SearcherState::NotInited => {
                let filename = self.session_file.filename()?;
                self.searchers.regular.in_use();
                Ok(RegularSearchHolder::new(&filename, uuid, 0, 0))
            }
        }
    }

    fn handle_get_search_values_holder(
        &mut self,
        uuid: Uuid,
    ) -> Result<ValueSearchHolder, stypes::NativeError> {
        match self.searchers.values {
            SearcherState::Available(_) => {
                use std::mem;
                if let SearcherState::Available(holder) =
                    mem::replace(&mut self.searchers.values, SearcherState::InUse)
                {
                    Ok(holder)
                } else {
                    Err(stypes::NativeError {
                        severity: stypes::Severity::ERROR,
                        kind: stypes::NativeErrorKind::Configuration,
                        message: Some(String::from(
                            "Could not replace search values holder in state",
                        )),
                    })
                }
            }
            SearcherState::InUse => Err(stypes::NativeError::channel(
                "Search values holder is in use",
            )),
            SearcherState::NotInited => {
                let filename = self.session_file.filename()?;
                self.searchers.values.in_use();
                Ok(ValueSearchHolder::new(&filename, uuid, 0, 0))
            }
        }
    }

    fn handle_add_attachment(
        &mut self,
        origin: definitions::Attachment,
        tx_callback_events: UnboundedSender<stypes::CallbackEvent>,
    ) -> Result<(), stypes::NativeError> {
        let attachment = self.attachments.add(origin)?;
        tx_callback_events.send(stypes::CallbackEvent::AttachmentsUpdated {
            len: self.attachments.len() as u64,
            attachment,
        })?;
        Ok(())
    }
}

pub async fn run(
    mut rx_api: UnboundedReceiver<Api>,
    tx_callback_events: UnboundedSender<stypes::CallbackEvent>,
) -> Result<(), stypes::NativeError> {
    let mut state = SessionState::new(tx_callback_events.clone());
    let state_cancellation_token = CancellationToken::new();
    debug!("task is started");
    while let Some(msg) = rx_api.recv().await {
        match msg {
            Api::SetSessionFile((session_file, tx_response)) => {
                let set_session_file_res = state.session_file.init(session_file);
                if let (Ok(_), Ok(filename)) =
                    (&set_session_file_res, state.session_file.filename())
                {
                    state.attachments.set_dest_path(filename);
                }
                tx_response.send(set_session_file_res).map_err(|_| {
                    stypes::NativeError::channel("Failed to response to Api::SetSessionFile")
                })?;
            }
            Api::GetSessionFile(tx_response) => {
                tx_response
                    .send(state.session_file.filename())
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::GetSessionFile")
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
                        stypes::NativeError::channel("Failed to respond to Api::WriteSessionFile")
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
                    stypes::NativeError::channel("Failed to respond to Api::FlushSessionFile")
                })?;
            }
            Api::GetSessionFileOrigin(tx_response) => {
                tx_response
                    .send(Ok(state.session_file.filename.clone()))
                    .map_err(|_| {
                        stypes::NativeError::channel(
                            "Failed to respond to Api::GetSessionFileOrigin",
                        )
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
                tx_response.send(res).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::UpdateSession")
                })?;
            }
            Api::AddSource(uuid, descriptor, tx_response) => {
                tx_response
                    .send(
                        state
                            .session_file
                            .sources
                            .add_source(uuid, descriptor.clone()),
                    )
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::AddSource")
                    })?;
                tx_callback_events.send(stypes::CallbackEvent::SessionDescriptor {
                    uuid,
                    desc: descriptor,
                })?;
            }
            Api::GetSourcesDefinitions(tx_response) => {
                tx_response
                    .send(state.session_file.sources.get_sources_definitions())
                    .map_err(|_| {
                        stypes::NativeError::channel(
                            "Failed to respond to Api::GetSourcesDefinitions",
                        )
                    })?;
            }
            Api::AddExecutedObserve((options, tx_response)) => {
                state.observed.add(options);
                tx_response.send(()).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::AddExecutedObserve")
                })?;
            }
            Api::GetExecutedHolder(tx_response) => {
                tx_response.send(state.observed.clone()).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::GetExecutedHolder")
                })?;
            }
            Api::IsRawExportAvailable(tx_response) => {
                tx_response
                    .send(state.observed.is_file_based_export_possible())
                    .map_err(|_| {
                        stypes::NativeError::channel(
                            "Failed to respond to Api::IsRawExportAvailable",
                        )
                    })?;
            }
            Api::ExportSession {
                out_path,
                ranges,
                columns,
                spliter,
                delimiter,
                cancel,
                tx_response,
            } => {
                let res = state
                    .handle_export_session(out_path, ranges, columns, spliter, delimiter, cancel)
                    .await;
                tx_response.send(res).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::ExportSession")
                })?;
            }
            Api::Grab((range, tx_response)) => {
                tx_response
                    .send(state.handle_grab(&range))
                    .map_err(|_| stypes::NativeError::channel("Failed to respond to Api::Grab"))?;
            }
            Api::GrabIndexed((range, tx_response)) => {
                tx_response
                    .send(state.handle_grab_indexed(range))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::GrabIndexed")
                    })?;
            }
            Api::SetIndexingMode((mode, tx_response)) => {
                tx_response
                    .send(state.indexes.set_mode(mode))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::SetIndexingMode")
                    })?;
            }
            Api::GetIndexedMapLen(tx_response) => {
                tx_response.send(state.indexes.len()).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::GetIndexedMapLen")
                })?;
            }
            Api::GetDistancesAroundIndex((position, tx_response)) => {
                tx_response
                    .send(state.indexes.get_around_indexes(&position))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::GetIndexedMapLen")
                    })?;
            }
            Api::AddBookmark((row, tx_response)) => {
                tx_response
                    .send(state.indexes.add_bookmark(row))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::AddBookmark")
                    })?;
            }
            Api::SetBookmarks((rows, tx_response)) => {
                tx_response
                    .send(state.indexes.set_bookmarks(rows))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::SetBookmarks")
                    })?;
            }
            Api::RemoveBookmark((row, tx_response)) => {
                tx_response
                    .send(state.indexes.remove_bookmark(row))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::RemoveBookmark")
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
                        stypes::NativeError::channel("Failed to respond to Api::ExpandBreadcrumbs")
                    })?;
            }
            Api::GrabSearch((range, tx_response)) => {
                tx_response
                    .send(state.handle_grab_search(range))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::GrabSearch")
                    })?;
            }
            Api::SearchNestedMatch((filter, from, rev, tx_response)) => {
                tx_response
                    .send(state.handle_search_nested_match(filter, from, rev))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::SearchNestedMatch")
                    })?;
            }
            Api::GrabRanges((ranges, tx_response)) => {
                tx_response
                    .send(state.handle_grab_ranges(ranges))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::GrabSearch")
                    })?;
            }
            Api::GetNearestPosition((position, tx_response)) => {
                tx_response
                    .send(stypes::ResultNearestPosition(
                        state.search_map.nearest_to(position),
                    ))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::GetNearestPosition")
                    })?;
            }
            Api::GetScaledMap((len, range, tx_response)) => {
                tx_response
                    .send(state.search_map.scaled(len, range))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::GetScaledMap")
                    })?;
            }
            Api::FileRead(tx_response) => {
                tx_callback_events.send(stypes::CallbackEvent::FileRead)?;
                tx_response.send(()).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::FileRead")
                })?;
            }
            Api::GetStreamLen(tx_response) => {
                tx_response
                    .send((state.session_file.len(), state.session_file.read_bytes()))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::GetStreamLen")
                    })?;
            }
            Api::GetSearchResultLen(tx_response) => {
                tx_response.send(state.search_map.len()).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::GetSearchResultLen")
                })?;
            }
            Api::GetSearchHolder((uuid, tx_response)) => {
                tx_response
                    .send(state.handle_get_search_holder(uuid))
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::GetSearchHolder")
                    })?;
            }
            Api::SetSearchHolder((mut holder, _uuid_for_debug, tx_response)) => {
                let result = if state.searchers.regular.is_using() {
                    if let Some(holder) = holder.take() {
                        state.searchers.regular.set(holder);
                    } else {
                        state.searchers.regular.not_inited();
                    }
                    Ok(())
                } else {
                    Err(stypes::NativeError::channel(
                        "Cannot set search holder - it wasn't in use",
                    ))
                };
                tx_response.send(result).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::SetSearchHolder")
                })?;
            }
            Api::DropSearch(tx_response) => {
                let result = if state.searchers.regular.is_using() {
                    false
                } else {
                    state.searchers.regular.not_inited();
                    state.search_map.set(None, None);
                    state.indexes.drop_search()?;
                    true
                };
                tx_callback_events.send(stypes::CallbackEvent::no_search_results())?;
                tx_callback_events.send(stypes::CallbackEvent::SearchMapUpdated(None))?;
                tx_response.send(result).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::DropSearch")
                })?;
            }
            Api::SetMatches((matches, stats, tx_response)) => {
                let update: Option<stypes::FilterMatchList> =
                    matches.as_ref().map(|matches| matches.into());
                if let Some(matches) = matches.as_ref() {
                    state.indexes.set_search_results(matches)?;
                }
                state.search_map.set(matches, stats);
                tx_callback_events.send(stypes::CallbackEvent::SearchMapUpdated(update))?;
                tx_callback_events.send(stypes::CallbackEvent::search_results(
                    state.search_map.len() as u64,
                    state.search_map.get_stats(),
                ))?;
                tx_response.send(()).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::SetMatches")
                })?;
            }
            Api::GetSearchValuesHolder((uuid, tx_response)) => {
                tx_response
                    .send(state.handle_get_search_values_holder(uuid))
                    .map_err(|_| {
                        stypes::NativeError::channel(
                            "Failed to respond to Api::GetSearchValuesHolder",
                        )
                    })?;
            }
            Api::SetSearchValuesHolder((mut holder, _uuid_for_debug, tx_response)) => {
                let result = if state.searchers.values.is_using() {
                    if let Some(holder) = holder.take() {
                        state.searchers.values.set(holder);
                    } else {
                        state.searchers.values.not_inited();
                    }
                    Ok(())
                } else {
                    Err(stypes::NativeError::channel(
                        "Cannot set search values holder - it wasn't in use",
                    ))
                };
                tx_response.send(result).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::SetSearchValuesHolder")
                })?;
            }
            Api::GetSearchValues((frame, width, tx_response)) => {
                tx_response
                    .send(state.values.get(frame, width))
                    .map_err(|_| {
                        stypes::NativeError::channel(
                            "Failed to respond to Api::SetSearchValuesHolder",
                        )
                    })?;
            }
            Api::SetSearchValues(values, tx_response) => {
                state.values.set_values(values);
                tx_response.send(()).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::SetSearchValues")
                })?;
            }
            Api::DropSearchValues(tx_response) => {
                let result = if state.searchers.values.is_using() {
                    false
                } else {
                    state.searchers.values.not_inited();
                    true
                };
                state.values.drop();
                tx_response.send(result).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::DropSearchValues")
                })?;
            }
            Api::GetIndexedRanges(tx_response) => {
                tx_response
                    .send(state.indexes.get_all_as_ranges())
                    .map_err(|_| {
                        stypes::NativeError::channel("Failed to respond to Api::GetIndexedRanges")
                    })?;
            }
            Api::CloseSession(tx_response) => {
                state_cancellation_token.cancel();
                state.status = Status::Closed;
                // Note: all operations would be canceled in close_session of API. We cannot do it here,
                // because we would lock this loop if some operation needs access to state during cancellation.
                if tx_response.send(()).is_err() {
                    return Err(stypes::NativeError::channel(
                        "fail to response to Api::CloseSession",
                    ));
                }
            }
            Api::SetDebugMode((debug, tx_response)) => {
                state.debug = debug;
                if tx_response.send(()).is_err() {
                    return Err(stypes::NativeError::channel(
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
            Api::AddAttachment(attachment) => {
                let at_name = attachment.name.clone();
                if let Err(err) =
                    state.handle_add_attachment(attachment, tx_callback_events.clone())
                {
                    error!("Fail to process attachment {at_name:?}; error: {err:?}");
                }
            }
            Api::GetAttachments(tx_response) => {
                tx_response.send(state.attachments.get()).map_err(|_| {
                    stypes::NativeError::channel("Failed to respond to Api::GetAttachments")
                })?;
            }
            Api::Shutdown => {
                state_cancellation_token.cancel();
                debug!("shutdown has been requested");
                break;
            }
            Api::ShutdownWithError => {
                debug!("shutdown state loop with error for testing");
                return Err(stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Io,
                    message: Some(String::from("Shutdown state loop with error for testing")),
                });
            }
        }
    }
    debug!("task is finished");
    Ok(())
}

impl Drop for SessionState {
    fn drop(&mut self) {
        // Ensure session files are cleaned up by calling the cleanup function on drop.
        if let Err(err) = self.session_file.cleanup() {
            log::error!("Cleaning up session files failed. Error: {err:#?}");
        }
    }
}
