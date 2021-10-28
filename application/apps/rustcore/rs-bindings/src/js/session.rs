use super::{handlers, session_operations as sop};
use crate::js::{
    converting::{
        concat::WrappedConcatenatorInput, filter::WrappedSearchFilter,
        merge::WrappedFileMergeOptions,
    },
    events::{
        AsyncBroadcastChannel, CallbackEvent, ComputationError, NativeError, NativeErrorKind,
        SyncChannel,
    },
};
use crossbeam_channel as cc;
use indexer_base::progress::Severity;
use log::{debug, error, info, warn};
use merging::{concatenator::ConcatenatorInput, merger::FileMergeOptions};
use node_bindgen::derive::node_bindgen;
use processor::{
    dlt_source::DltSource,
    grabber::{AsyncGrabTrait, GrabMetadata, GrabTrait, GrabbedContent, LineRange},
    map::{NearestPosition, SearchMap},
    search::{SearchError, SearchFilter},
    text_source::TextFileSource,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    fs::OpenOptions,
    path::{Path, PathBuf},
    thread,
};
use tokio::{runtime::Runtime, sync::broadcast};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Debug)]
pub struct SessionState {
    pub assigned_file: Option<String>,
    pub filters: Vec<SearchFilter>,
    pub search_map: SearchMap,
    pub metadata: Option<GrabMetadata>,
}

#[derive(Debug, Clone)]
enum Operation {
    Assign {
        file_path: PathBuf,
        source_id: String,
        operation_id: Uuid,
        source_type: SupportedFileType,
        cancellation_token: CancellationToken,
    },
    Search {
        target_file: PathBuf,
        filters: Vec<SearchFilter>,
        operation_id: Uuid,
    },
    Extract {
        target_file: PathBuf,
        filters: Vec<SearchFilter>,
        operation_id: Uuid,
    },
    Map {
        dataset_len: u16,
        range: Option<(u64, u64)>,
        operation_id: Uuid,
    },
    Concat {
        files: Vec<ConcatenatorInput>,
        out_path: PathBuf,
        append: bool,
        source_type: SupportedFileType,
        source_id: String,
        operation_id: Uuid,
        cancellation_token: CancellationToken,
    },
    Merge {
        files: Vec<FileMergeOptions>,
        out_path: PathBuf,
        append: bool,
        source_type: SupportedFileType,
        source_id: String,
        operation_id: Uuid,
        cancellation_token: CancellationToken,
    },
    ExtractMetadata(cc::Sender<Option<GrabMetadata>>),
    DropSearch(cc::Sender<()>),
    GetNearestPosition((u64, cc::Sender<Option<NearestPosition>>)),
    Cancel {
        operation_id: Uuid,
    },
    End,
}

async fn process_operation_request<F: Fn(CallbackEvent) + Send + 'static>(
    op_event: Operation,
    state: &mut SessionState,
    search_metadata_tx: &cc::Sender<Option<(PathBuf, GrabMetadata)>>,
    operations: &mut HashMap<Uuid, CancellationToken>,
    callback: &F,
) -> bool {
    match op_event {
        Operation::Assign {
            file_path,
            source_id,
            operation_id,
            source_type,
            cancellation_token,
        } => {
            debug!("RUST: received Assign operation event");
            sop::finish(
                operation_id,
                vec![sop::map_err(
                    handlers::assign::handle(
                        operation_id,
                        &file_path,
                        source_type,
                        source_id,
                        state,
                        cancellation_token,
                    ),
                    operation_id,
                )],
                operations,
                callback,
            );
        }
        Operation::Search {
            target_file,
            filters,
            operation_id,
        } => {
            sop::finish(
                operation_id,
                handlers::search::handle(
                    target_file,
                    filters,
                    operation_id,
                    search_metadata_tx,
                    state,
                ),
                operations,
                callback,
            );
        }
        Operation::Extract {
            target_file,
            filters,
            operation_id,
        } => {
            debug!("RUST: Extract values operation is requested");
            sop::finish(
                operation_id,
                vec![sop::map_result(
                    handlers::extract::handle(&target_file, filters.iter()),
                    operation_id,
                )],
                operations,
                callback,
            );
        }
        Operation::Map {
            dataset_len,
            range,
            operation_id,
        } => {
            debug!("RUST: received Map operation event");
            callback(sop::map_entity(
                &(state.search_map.scaled(dataset_len, range)),
                operation_id,
            ));
        }
        Operation::Concat {
            files,
            out_path,
            append,
            source_type,
            source_id,
            operation_id,
            cancellation_token,
        } => {
            debug!(
                "RUST: received concat operation event with operation id {}",
                operation_id
            );
            sop::finish(
                operation_id,
                vec![sop::map_err(
                    handlers::concat::handle(
                        operation_id,
                        files,
                        &out_path,
                        append,
                        source_type,
                        source_id,
                        state,
                        cancellation_token,
                    )
                    .await,
                    operation_id,
                )],
                operations,
                callback,
            );
        }
        Operation::Merge {
            files,
            out_path,
            append,
            source_type,
            source_id,
            operation_id,
            cancellation_token,
        } => {
            debug!(
                "RUST: received concat operation event with operation id {}",
                operation_id
            );
            sop::finish(
                operation_id,
                vec![sop::map_err(
                    handlers::merge::handle(
                        operation_id,
                        files,
                        &out_path,
                        append,
                        source_type,
                        source_id,
                        state,
                        cancellation_token,
                    )
                    .await,
                    operation_id,
                )],
                operations,
                callback,
            );
        }
        Operation::Cancel { operation_id } => {
            debug!("RUST: received cancel operation event");
            if let Some(token) = operations.remove(&operation_id) {
                token.cancel();
            } else {
                callback(CallbackEvent::OperationError {
                    uuid: operation_id,
                    error: NativeError {
                        severity: Severity::WARNING,
                        kind: NativeErrorKind::NotYetImplemented,
                        message: Some(format!("Operation {} isn't found", operation_id)),
                    },
                });
            }
        }
        Operation::ExtractMetadata(tx_response) => {
            if let Err(err) = tx_response.send(if let Some(md) = &state.metadata {
                let md = md.clone();
                state.metadata = None;
                Some(md)
            } else {
                None
            }) {
                error!(
                    "fail to responce to Operation::ExtractMetadata; error: {}",
                    err
                );
            }
        }
        Operation::DropSearch(tx_response) => {
            state.search_map.set(None);
            if let Err(err) = tx_response.send(()) {
                error!("fail to responce to Operation::DropSearch; error: {}", err);
            }
        }
        Operation::GetNearestPosition((position, tx_response)) => {
            if let Err(err) = tx_response.send(state.search_map.nearest_to(position)) {
                error!(
                    "fail to responce to Operation::GetNearestPosition; error: {}",
                    err
                );
            }
        }
        Operation::End => {
            debug!("RUST: received End operation event");
            callback(CallbackEvent::SessionDestroyed);
            return true;
        }
    }
    false
}

#[derive(Debug, Serialize, Clone)]
pub enum SupportedFileType {
    Text,
    Dlt,
}

pub fn get_supported_file_type(path: &Path) -> Option<SupportedFileType> {
    let extension = path.extension().map(|ext| ext.to_string_lossy());
    match extension {
        Some(ext) => match ext.to_lowercase().as_ref() {
            "dlt" => Some(SupportedFileType::Dlt),
            "txt" | "text" => Some(SupportedFileType::Text),
            _ => Some(SupportedFileType::Text),
        },
        None => Some(SupportedFileType::Text),
    }
}

fn lazy_init_grabber(
    input_p: &Path,
    source_id: &str,
) -> Result<(SupportedFileType, Box<dyn AsyncGrabTrait>), ComputationError> {
    match get_supported_file_type(input_p) {
        Some(SupportedFileType::Text) => {
            type GrabberType = processor::grabber::Grabber<TextFileSource>;
            let source = TextFileSource::new(input_p, source_id);
            let grabber = GrabberType::lazy(source).map_err(|e| {
                let err_msg = format!("Could not create grabber: {}", e);
                warn!("{}", err_msg);
                ComputationError::Process(err_msg)
            })?;
            Ok((SupportedFileType::Text, Box::new(grabber)))
        }
        Some(SupportedFileType::Dlt) => {
            type GrabberType = processor::grabber::Grabber<DltSource>;
            let source = DltSource::new(input_p, source_id);
            let grabber = GrabberType::lazy(source).map_err(|e| {
                ComputationError::Process(format!("Could not create grabber: {}", e))
            })?;
            Ok((SupportedFileType::Dlt, Box::new(grabber)))
        }
        None => {
            warn!("Trying to assign unsupported file type: {:?}", input_p);
            Err(ComputationError::OperationNotSupported(
                "Unsupported file type".to_string(),
            ))
        }
    }
}

#[derive(Debug)]
pub struct RustSession {
    pub id: String,
    pub running: bool,
    pub content_grabber: Option<Box<dyn AsyncGrabTrait>>,
    pub search_grabber: Option<Box<dyn AsyncGrabTrait>>,
    op_channel: AsyncBroadcastChannel<Operation>,
    // channel to store the metadata of the search results once available
    search_metadata_channel: SyncChannel<Option<(PathBuf, GrabMetadata)>>,
}

impl RustSession {
    /// will result in a grabber that has it's metadata generated
    /// this function will first check if there has been some new metadata that was previously
    /// written to the metadata-channel. If so, this metadata is used in the grabber.
    /// If there was no new metadata, we make sure that the metadata has been set.
    /// If no metadata is available, an error is returned. That means that assign was not completed before.
    fn get_updated_content_grabber(
        &mut self,
    ) -> Result<&mut Box<dyn AsyncGrabTrait>, ComputationError> {
        let current_grabber = match &mut self.content_grabber {
            Some(c) => Ok(c),
            None => {
                let msg = "Need a grabber first to work with metadata".to_owned();
                warn!("{}", msg);
                Err(ComputationError::Protocol(msg))
            }
        }?;
        let (tx_response, rx_response): (
            cc::Sender<Option<GrabMetadata>>,
            cc::Receiver<Option<GrabMetadata>>,
        ) = cc::bounded(1);
        self.op_channel
            .0
            .send(Operation::ExtractMetadata(tx_response))
            .map_err(|e| ComputationError::Process(e.to_string()))?;
        match rx_response.recv() {
            Ok(metadata) => {
                if let Some(metadata) = metadata {
                    current_grabber
                        .inject_metadata(metadata)
                        .map_err(|e| ComputationError::Process(format!("{:?}", e)))?;
                }
            }
            Err(err) => {
                warn!("Fail to get a metadata; error: {}", err);
            }
        };
        Ok(current_grabber)
    }

    fn get_search_grabber(
        &mut self,
    ) -> Result<Option<&mut Box<dyn AsyncGrabTrait>>, ComputationError> {
        if self.search_grabber.is_none() && !self.search_metadata_channel.1.is_empty() {
            // We are intrested only in last message in queue, all others messages can be just dropped.
            let latest = self.search_metadata_channel.1.try_iter().last().flatten();
            if let Some((file_path, metadata)) = latest {
                type GrabberType = processor::grabber::Grabber<TextFileSource>;
                let source = TextFileSource::new(&file_path, "search_results");
                let mut grabber = match GrabberType::new(source) {
                    Ok(grabber) => grabber,
                    Err(err) => {
                        let msg = format!("Failed to create search grabber. Error: {}", err);
                        warn!("{}", msg);
                        return Err(ComputationError::Protocol(msg));
                    }
                };
                if let Err(err) = grabber.inject_metadata(metadata) {
                    let msg = format!(
                        "Failed to inject metadata into search grabber. Error: {}",
                        err
                    );
                    warn!("{}", msg);
                    return Err(ComputationError::Protocol(msg));
                }
                self.search_grabber = Some(Box::new(grabber));
            } else {
                self.search_grabber = None;
            }
        }
        let grabber = match &mut self.search_grabber {
            Some(c) => c,
            None => return Ok(None),
        };
        match grabber.get_metadata() {
            Some(_) => {
                debug!("RUST: reusing cached metadata");
                Ok(Some(grabber))
            }
            None => {
                let msg = "No metadata available for search grabber".to_owned();
                warn!("{}", msg);
                Err(ComputationError::Protocol(msg))
            }
        }
    }
}

#[node_bindgen]
impl RustSession {
    #[node_bindgen(constructor)]
    pub fn new(id: String) -> Self {
        Self {
            id,
            running: false,
            content_grabber: None,
            search_grabber: None,
            op_channel: broadcast::channel(10),
            search_metadata_channel: cc::unbounded(),
        }
    }

    #[node_bindgen(getter)]
    fn id(&self) -> String {
        self.id.clone()
    }

    #[node_bindgen]
    fn cancel_operations(&mut self, operation_id_string: String) -> Result<(), ComputationError> {
        let _ = self.op_channel.0.send(Operation::Cancel {
            operation_id: sop::uuid_from_str(&operation_id_string)?,
        });
        Ok(())
    }

    /// this will start of the event loop that processes different rust operations
    /// in the event-loop-thread
    /// the callback is used to report back to javascript
    #[node_bindgen(mt)]
    fn start<F: Fn(CallbackEvent) + Send + 'static>(
        &mut self,
        callback: F,
    ) -> Result<(), ComputationError> {
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {}", e))
        })?;
        let mut event_stream = self.op_channel.0.subscribe();
        self.running = true;
        let search_metadata_tx = self.search_metadata_channel.0.clone();
        thread::spawn(move || {
            rt.block_on(async {
                info!("RUST: running runtime");
                let mut operations: HashMap<Uuid, CancellationToken> = HashMap::new();
                let mut state = SessionState {
                    assigned_file: None,
                    filters: vec![],
                    search_map: SearchMap::new(),
                    metadata: None,
                };
                loop {
                    match event_stream.recv().await {
                        Ok(op_event) => {
                            let abort = process_operation_request(
                                op_event,
                                &mut state,
                                &search_metadata_tx,
                                &mut operations,
                                &callback,
                            )
                            .await;
                            if abort {
                                break;
                            }
                        }
                        Err(e) => {
                            debug!("Rust: error on channel: {}", e);
                            break;
                        }
                    }
                }
                info!("RUST: exiting runtime");
            })
        });
        Ok(())
    }

    #[node_bindgen]
    fn get_stream_len(&mut self) -> Result<i64, ComputationError> {
        match &self.get_updated_content_grabber()?.get_metadata() {
            Some(md) => Ok(md.line_count as i64),
            None => Err(ComputationError::Protocol("Cannot happen".to_owned())),
        }
    }

    #[node_bindgen]
    fn get_search_len(&mut self) -> Result<i64, ComputationError> {
        let grabber = if let Some(grabber) = self.get_search_grabber()? {
            grabber
        } else {
            return Ok(0);
        };
        match grabber.get_metadata() {
            Some(md) => Ok(md.line_count as i64),
            None => Ok(0),
        }
    }

    #[node_bindgen]
    fn grab(
        &mut self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationError> {
        info!(
            "RUST: grab from {} ({} lines)",
            start_line_index, number_of_lines
        );
        let grabbed_content = self
            .get_updated_content_grabber()?
            .grab_content(&LineRange::from(
                (start_line_index as u64)..=((start_line_index + number_of_lines - 1) as u64),
            ))
            .map_err(|e| ComputationError::Communication(format!("grab content failed: {}", e)))?;
        let serialized =
            serde_json::to_string(&grabbed_content).map_err(|_| ComputationError::InvalidData)?;
        Ok(serialized)
    }

    #[node_bindgen]
    fn stop(&mut self) -> Result<(), ComputationError> {
        let _ = self.op_channel.0.send(Operation::End);
        self.running = false;
        Ok(())
    }

    #[node_bindgen]
    async fn assign(
        &mut self,
        file_path: String,
        source_id: String,
        operation_id_string: String,
    ) -> Result<(), ComputationError> {
        debug!("RUST: send assign event on channel");
        let operation_id = sop::uuid_from_str(&operation_id_string)?;
        let input_p = PathBuf::from(&file_path);
        let (source_type, boxed_grabber) = lazy_init_grabber(&input_p, &source_id)?;
        self.content_grabber = Some(boxed_grabber);
        let op_channel_tx = self.op_channel.0.clone();
        let cancellation_token = CancellationToken::new();
        match op_channel_tx.send(Operation::Assign {
            file_path: input_p,
            source_id,
            operation_id,
            source_type,
            cancellation_token,
        }) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))),
        }
    }

    #[node_bindgen]
    fn grab_search(
        &mut self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationError> {
        info!(
            "RUST: grab search results from {} ({} lines)",
            start_line_index, number_of_lines
        );
        let grabber = if let Some(grabber) = self.get_search_grabber()? {
            grabber
        } else {
            let serialized = serde_json::to_string(&GrabbedContent {
                grabbed_elements: vec![],
            })
            .map_err(|_| ComputationError::InvalidData)?;
            return Ok(serialized);
        };
        let grabbed_content: GrabbedContent = grabber
            .grab_content(&LineRange::from(
                (start_line_index as u64)..=((start_line_index + number_of_lines) as u64),
            ))
            .map_err(|e| {
                warn!("Grab search content failed: {}", e);
                ComputationError::SearchError(SearchError::Grab(e))
            })?;
        let mut results: GrabbedContent = GrabbedContent {
            grabbed_elements: vec![],
        };
        let mut ranges = vec![];
        let mut from_pos: u64 = 0;
        let mut to_pos: u64 = 0;
        for (i, el) in grabbed_content.grabbed_elements.iter().enumerate() {
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
                Err(e) => {
                    return Err(ComputationError::Process(format!("{}", e)));
                }
            }
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from_pos)
            || (ranges.is_empty() && !grabbed_content.grabbed_elements.is_empty())
        {
            ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
        }
        let mut row: usize = start_line_index as usize;
        for range in ranges.iter() {
            let mut original_content = self
                .get_updated_content_grabber()?
                .grab_content(&LineRange::from(range.clone()))
                .map_err(|e| {
                    ComputationError::Communication(format!("grab matched content failed: {}", e))
                })?;
            let start = *range.start() as usize;
            for (j, element) in original_content.grabbed_elements.iter_mut().enumerate() {
                element.pos = Some(start + j);
                element.row = Some(row);
                row += 1;
            }
            results
                .grabbed_elements
                .append(&mut original_content.grabbed_elements);
        }
        debug!(
            "RUST: grabbing search result from original content {} rows",
            results.grabbed_elements.len()
        );
        let serialized =
            serde_json::to_string(&results).map_err(|_| ComputationError::InvalidData)?;
        Ok(serialized)
    }

    #[node_bindgen]
    async fn apply_search_filters(
        &mut self,
        filters: Vec<WrappedSearchFilter>,
        operation_id_string: String,
    ) -> Result<(), ComputationError> {
        let operation_id = sop::uuid_from_str(&operation_id_string)?;
        self.search_grabber = None;
        let (tx_response, rx_response): (cc::Sender<()>, cc::Receiver<()>) = cc::bounded(1);
        self.op_channel
            .0
            .send(Operation::DropSearch(tx_response))
            .map_err(|e| ComputationError::Process(e.to_string()))?;
        if let Err(err) = rx_response.recv() {
            return Err(ComputationError::Process(format!(
                "Cannot drop search map. Error: {}",
                err
            )));
        }
        let target_file = if let Some(content) = self.content_grabber.as_ref() {
            content.as_ref().associated_file()
        } else {
            warn!("Cannot search when no file has been assigned");
            return Err(ComputationError::NoAssignedContent);
        };
        let filters: Vec<SearchFilter> = filters.iter().map(|f| f.as_filter()).collect();
        info!(
            "Search (operation: {}) will be done in {:?} withing next filters: {:?}",
            operation_id, target_file, filters
        );
        let op_channel_tx = self.op_channel.0.clone();
        match op_channel_tx
            .send(Operation::Search {
                target_file,
                operation_id,
                filters,
            })
            .map_err(|_| {
                ComputationError::Process("Could not send operation on channel".to_string())
            }) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))),
        }
    }

    #[node_bindgen]
    async fn extract_matches(
        &mut self,
        filters: Vec<WrappedSearchFilter>,
        operation_id_string: String,
    ) -> Result<(), ComputationError> {
        let operation_id = sop::uuid_from_str(&operation_id_string)?;
        let target_file = if let Some(content) = self.content_grabber.as_ref() {
            content.as_ref().associated_file()
        } else {
            return Err(ComputationError::NoAssignedContent);
        };
        let filters: Vec<SearchFilter> = filters.iter().map(|f| f.as_filter()).collect();
        info!(
            "Extract (operation: {}) will be done in {:?} withing next filters: {:?}",
            operation_id, target_file, filters
        );
        let op_channel_tx = self.op_channel.0.clone();
        async move {
            match op_channel_tx
                .send(Operation::Extract {
                    target_file,
                    operation_id,
                    filters,
                })
                .map_err(|_| {
                    ComputationError::Process("Could not send operation on channel".to_string())
                }) {
                Ok(_) => Ok(()),
                Err(e) => Err(ComputationError::Process(format!(
                    "Could not send operation on channel. Error: {}",
                    e
                ))),
            }
        }
        .await
    }

    #[node_bindgen]
    fn get_map(
        &mut self,
        dataset_len: i32,
        from: Option<i64>,
        to: Option<i64>,
    ) -> Result<String, ComputationError> {
        let operation_id = Uuid::new_v4();
        let mut range: Option<(u64, u64)> = None;
        if let Some(from) = from {
            if let Some(to) = to {
                if from >= 0 && to >= 0 {
                    if from <= to {
                        range = Some((from as u64, to as u64));
                    } else {
                        warn!(
                            "Invalid range (operation: {}): from = {}; to = {}",
                            operation_id, from, to
                        );
                    }
                }
            }
        }
        info!(
            "Map requested (operation: {}). Range: {:?}",
            operation_id, range
        );
        if let Err(e) = self
            .op_channel
            .0
            .send(Operation::Map {
                dataset_len: dataset_len as u16,
                range,
                operation_id,
            })
            .map_err(|_| {
                ComputationError::Process("Could not send operation on channel".to_string())
            })
        {
            return Err(e);
        }
        Ok(operation_id.to_string())
    }

    #[node_bindgen]
    fn get_nearest_to(
        &mut self,
        position_in_stream: i64,
    ) -> Result<
        Option<(
            i64, // Position in search results
            i64, // Position in stream/file
        )>,
        ComputationError,
    > {
        let (tx_response, rx_response): (
            cc::Sender<Option<NearestPosition>>,
            cc::Receiver<Option<NearestPosition>>,
        ) = cc::bounded(1);
        self.op_channel
            .0
            .send(Operation::GetNearestPosition((
                position_in_stream as u64,
                tx_response,
            )))
            .map_err(|e| ComputationError::Process(e.to_string()))?;
        match rx_response.recv() {
            Ok(nearest) => {
                if let Some(nearest) = nearest {
                    Ok(Some((nearest.index as i64, nearest.position as i64)))
                } else {
                    Ok(None)
                }
            }
            Err(err) => Err(ComputationError::Process(format!(
                "Could not get access to state of session: {}",
                err
            ))),
        }
    }

    #[node_bindgen]
    async fn concat(
        &mut self,
        files: Vec<WrappedConcatenatorInput>,
        append: bool,
        operation_id: String,
    ) -> Result<(), ComputationError> {
        //TODO: out_path should be gererics by some settings.
        let operation_id = sop::uuid_from_str(&operation_id)?;
        let (out_path, out_path_str) = if files.is_empty() {
            return Err(ComputationError::InvalidData);
        } else {
            let filename = PathBuf::from(&files[0].as_concatenator_input().path);
            if let Some(parent) = filename.parent() {
                if let Some(file_name) = filename.file_name() {
                    let path = parent.join(format!("{}.concat", file_name.to_string_lossy()));
                    (path.clone(), path.to_string_lossy().to_string())
                } else {
                    return Err(ComputationError::InvalidData);
                }
            } else {
                return Err(ComputationError::InvalidData);
            }
        };
        let _ = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&out_path)
            .map_err(|_| {
                ComputationError::IoOperation(format!(
                    "Could not create/open file {}",
                    &out_path_str
                ))
            })?;
        let (source_type, boxed_grabber) = lazy_init_grabber(&out_path, &out_path_str)?;
        self.content_grabber = Some(boxed_grabber);
        let cancellation_token = CancellationToken::new();
        match self.op_channel.0.send(Operation::Concat {
            files: files
                .iter()
                .map(|file| file.as_concatenator_input())
                .collect(),
            out_path,
            append,
            source_type,
            source_id: out_path_str,
            operation_id,
            cancellation_token,
        }) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))),
        }
    }

    #[node_bindgen]
    async fn merge(
        &mut self,
        files: Vec<WrappedFileMergeOptions>,
        append: bool,
        operation_id: String,
    ) -> Result<(), ComputationError> {
        //TODO: out_path should be gererics by some settings.
        let operation_id = sop::uuid_from_str(&operation_id)?;
        let (out_path, out_path_str) = if files.is_empty() {
            return Err(ComputationError::InvalidData);
        } else {
            let filename = PathBuf::from(&files[0].as_file_merge_options().path);
            if let Some(parent) = filename.parent() {
                if let Some(file_name) = filename.file_name() {
                    let path = parent.join(format!("{}.merged", file_name.to_string_lossy()));
                    (path.clone(), path.to_string_lossy().to_string())
                } else {
                    return Err(ComputationError::InvalidData);
                }
            } else {
                return Err(ComputationError::InvalidData);
            }
        };
        let _ = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&out_path)
            .map_err(|_| {
                ComputationError::IoOperation(format!(
                    "Could not create/open file {}",
                    &out_path_str
                ))
            })?;
        let (source_type, boxed_grabber) = lazy_init_grabber(&out_path, &out_path_str)?;
        self.content_grabber = Some(boxed_grabber);
        let cancellation_token = CancellationToken::new();
        match self.op_channel.0.send(Operation::Merge {
            files: files
                .iter()
                .map(|file| file.as_file_merge_options())
                .collect(),
            out_path,
            append,
            source_type,
            source_id: out_path_str,
            operation_id,
            cancellation_token,
        }) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))),
        }
    }
}

// TODO:
//         - allow break search operation
//         - break previous search before start new
//
//         method getFilters(mut cx) {
//         method shutdown(mut cx) {

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GeneralError {
    severity: Severity,
    message: String,
}
