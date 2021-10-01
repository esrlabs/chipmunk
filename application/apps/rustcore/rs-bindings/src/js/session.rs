use crate::js::events::{
    AsyncBroadcastChannel, CallbackEvent, ComputationError, NativeError, NativeErrorKind,
    OperationDone, SearchOperationResult, SyncChannel,
};
use crossbeam_channel as cc;
use indexer_base::progress::{ComputationResult, Progress, Severity};
use log::{debug, info, trace, warn};
use merging::concatenator::concat_files_use_config_file;
use node_bindgen::{
    core::{
        val::{JsEnv, JsObject},
        JSValue, NjError, TryIntoJs,
    },
    derive::node_bindgen,
    sys::napi_value,
};
use processor::{
    dlt_source::DltSource,
    grabber::{
        AsyncGrabTrait, GrabError, GrabMetadata, GrabTrait, GrabbedContent, LineRange,
        MetadataSource,
    },
    map::SearchMap,
    search::{
        ExtractedMatchValue, FilterStats, MatchesExtractor, SearchError, SearchFilter, SearchHolder,
    },
    text_source::TextFileSource,
};
use serde::Serialize;
use std::{
    fs::OpenOptions,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
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
        config_file: PathBuf,
        out_path: PathBuf,
        append: bool,
        source_type: SupportedFileType,
        source_id: String,
        operation_id: Uuid,
        cancellation_token: CancellationToken,
    },
    Cancel {
        operation_id: Uuid,
    },
    End,
}

async fn process_operation_request<F: Fn(CallbackEvent) + Send + 'static>(
    op_event: Operation,
    state: Arc<Mutex<SessionState>>,
    search_metadata_tx: &cc::Sender<Option<(PathBuf, GrabMetadata)>>,
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
            let callback_event = match handle_assign(
                &file_path,
                source_type,
                source_id,
                &state,
                cancellation_token,
            ) {
                Ok(Some(line_count)) => CallbackEvent::StreamUpdated(line_count),
                Ok(None) => CallbackEvent::Progress {
                    uuid: operation_id,
                    progress: Progress::Stopped,
                },
                Err(error) => CallbackEvent::OperationError {
                    uuid: operation_id,
                    error,
                },
            };
            callback(callback_event);
            callback(CallbackEvent::OperationDone(OperationDone {
                uuid: operation_id,
                result: None,
            }));
        }
        Operation::Search {
            target_file,
            filters,
            operation_id,
        } => {
            for event in handle_search(
                target_file,
                filters,
                operation_id,
                search_metadata_tx,
                &state,
            ) {
                callback(event);
            }
        }
        Operation::Extract {
            target_file,
            filters,
            operation_id,
        } => {
            debug!("RUST: Extract values operation is requested");
            callback(handle_extract(&target_file, filters.iter(), operation_id));
        }
        Operation::Map {
            dataset_len,
            range,
            operation_id,
        } => {
            debug!("RUST: received Map operation event");
            match state.lock() {
                Ok(state) => {
                    callback(result_to_callback_event(
                        &(state.search_map.scaled(dataset_len, range)),
                        operation_id,
                    ));
                }
                Err(err) => {
                    callback(CallbackEvent::OperationError {
                        uuid: operation_id,
                        error: NativeError {
                            severity: Severity::ERROR,
                            kind: NativeErrorKind::OperationSearch,
                            message: Some(format!("Failed to write search map. Error: {}", err)),
                        },
                    });
                }
            };
        }
        Operation::Concat {
            config_file,
            out_path,
            append,
            source_type,
            source_id,
            operation_id,
            cancellation_token,
        } => {
            warn!(
                "RUST: received concat operation event with operation id {}",
                operation_id
            );
            let callback_event = handle_concat(
                operation_id,
                &config_file,
                &out_path,
                append,
                source_type,
                source_id,
                &state,
                cancellation_token,
            )
            .await;
            callback(callback_event);
            callback(CallbackEvent::OperationDone(OperationDone {
                uuid: operation_id,
                result: None,
            }));
        }
        Operation::Cancel { operation_id } => {
            debug!("RUST: received cancel operation event");
            callback(CallbackEvent::OperationError {
                uuid: operation_id,
                error: NativeError {
                    severity: Severity::WARNING,
                    kind: NativeErrorKind::NotYetImplemented,
                    message: Some("Cancel operation not implemented".to_string()),
                },
            });
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
    pub state: Arc<Mutex<SessionState>>,
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
        match self.state.lock() {
            Ok(mut state) => {
                if let Some(md) = &state.metadata {
                    current_grabber
                        .inject_metadata(md.clone())
                        .map_err(|e| ComputationError::Process(format!("{:?}", e)))?;
                    state.metadata = None;
                }
            }
            Err(_) => {
                warn!("Could not access state");
            }
        }
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
            state: Arc::new(Mutex::new(SessionState {
                assigned_file: None,
                filters: vec![],
                search_map: SearchMap::new(),
                metadata: None,
            })),
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
        match Uuid::parse_str(&operation_id_string) {
            Ok(operation_id) => {
                let _ = self.op_channel.0.send(Operation::Cancel { operation_id });
                Ok(())
            }
            Err(_) => Err(ComputationError::OperationNotSupported(format!(
                "Unknown operation-id: {}",
                operation_id_string
            ))),
        }
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
        let state = Arc::clone(&self.state);
        thread::spawn(move || {
            rt.block_on(async {
                info!("RUST: running runtime");
                loop {
                    match event_stream.recv().await {
                        Ok(op_event) => {
                            let abort = process_operation_request(
                                op_event,
                                state.clone(),
                                &search_metadata_tx,
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
        let operation_id = parse_operation_id(&operation_id_string)?;
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
        let operation_id = parse_operation_id(&operation_id_string)?;
        self.search_grabber = None;
        match self.state.lock() {
            Ok(mut state) => state.search_map.set(None),
            Err(err) => {
                return Err(ComputationError::Process(format!(
                    "Cannot drop search map. Error: {}",
                    err
                )));
            }
        };
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
        let operation_id = parse_operation_id(&operation_id_string)?;
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
        match self.state.lock() {
            Ok(state) => {
                if let Some(nearest) = state.search_map.nearest_to(position_in_stream as u64) {
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
        config_file: String,
        out_path_name: String,
        append: bool,
        operation_id: String,
    ) -> Result<(), ComputationError> {
        let config_file = PathBuf::from(config_file);
        let out_path = PathBuf::from(&out_path_name);
        let _ = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&out_path)
            .map_err(|_| {
                ComputationError::IoOperation(format!(
                    "Could not create/open file {}",
                    &out_path_name
                ))
            })?;
        let operation_id = parse_operation_id(&operation_id)?;
        let (source_type, boxed_grabber) = lazy_init_grabber(&out_path, &out_path_name)?;
        self.content_grabber = Some(boxed_grabber);

        let cancellation_token = CancellationToken::new();
        match self.op_channel.0.send(Operation::Concat {
            config_file,
            out_path,
            append,
            source_type,
            source_id: out_path_name,
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

impl TryIntoJs for CallbackEvent {
    /// serialize into json object
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        match serde_json::to_string(&self) {
            Ok(s) => js_env.create_string_utf8(&s),
            Err(e) => Err(NjError::Other(format!(
                "Could not convert Callback event to json: {}",
                e
            ))),
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct WrappedSearchFilter(SearchFilter);

impl WrappedSearchFilter {
    pub fn as_filter(&self) -> SearchFilter {
        self.0.clone()
    }
}

impl JSValue<'_> for WrappedSearchFilter {
    fn convert_to_rust(env: &JsEnv, n_value: napi_value) -> Result<Self, NjError> {
        if let Ok(js_obj) = env.convert_to_rust::<JsObject>(n_value) {
            // let mut filter = ;
            let value: String = match js_obj.get_property("value") {
                Ok(Some(value)) => match value.as_value::<String>() {
                    Ok(s) => s,
                    Err(e) => {
                        return Err(e);
                    }
                },
                Ok(None) => {
                    return Err(NjError::Other("[value] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let is_regex: bool = match js_obj.get_property("is_regex") {
                Ok(Some(value)) => match value.as_value::<bool>() {
                    Ok(s) => s,
                    Err(e) => {
                        return Err(e);
                    }
                },
                Ok(None) => {
                    return Err(NjError::Other(
                        "[is_regex] property is not found".to_owned(),
                    ));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let is_word: bool = match js_obj.get_property("is_word") {
                Ok(Some(value)) => match value.as_value::<bool>() {
                    Ok(s) => s,
                    Err(e) => {
                        return Err(e);
                    }
                },
                Ok(None) => {
                    return Err(NjError::Other("[is_word] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let ignore_case: bool = match js_obj.get_property("ignore_case") {
                Ok(Some(value)) => match value.as_value::<bool>() {
                    Ok(s) => s,
                    Err(e) => {
                        return Err(e);
                    }
                },
                Ok(None) => {
                    return Err(NjError::Other(
                        "[ignore_case] property is not found".to_owned(),
                    ));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            Ok(WrappedSearchFilter(SearchFilter {
                value,
                is_regex,
                ignore_case,
                is_word,
            }))
        } else {
            Err(NjError::Other("not valid format".to_owned()))
        }
    }
}

fn create_metadata_for_source(
    file_path: &Path,
    source_type: SupportedFileType,
    source_id: String,
) -> Result<ComputationResult<GrabMetadata>, GrabError> {
    match source_type {
        SupportedFileType::Dlt => {
            let source = DltSource::new(file_path, &source_id);
            source.from_file(None)
        }
        SupportedFileType::Text => {
            let source = TextFileSource::new(file_path, &source_id);
            source.from_file(None)
        }
    }
}

fn run_search<'a, I>(
    target_file_path: &Path,
    filters: I,
    state: &Arc<Mutex<SessionState>>,
) -> Result<(PathBuf, usize, FilterStats), NativeError>
where
    I: Iterator<Item = &'a SearchFilter>,
{
    let search_holder = SearchHolder::new(target_file_path, filters);
    match search_holder.execute_search() {
        Ok((file_path, matches, stats)) => {
            let found = matches.len();
            match state.lock() {
                Ok(mut state) => {
                    state.search_map.set(Some(matches));
                    Ok((file_path, found, stats))
                }
                Err(err) => Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::OperationSearch,
                    message: Some(format!("Fail write search map. Error: {}", err)),
                }),
            }
        }
        Err(err) => Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::OperationSearch,
            message: Some(format!("Fail to execute search. Error: {}", err)),
        }),
    }
}

fn handle_extract<'a, I>(target_file_path: &Path, filters: I, operation_id: Uuid) -> CallbackEvent
where
    I: Iterator<Item = &'a SearchFilter>,
{
    let extractor = MatchesExtractor::new(target_file_path, filters);

    let matches = match extractor.extract_matches() {
        Ok(matches) => Ok(matches),
        Err(err) => Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::OperationSearch,
            message: Some(format!(
                "Fail to execute extract search result operation. Error: {}",
                err
            )),
        }),
    };

    match matches {
        Ok(matches) => result_to_callback_event::<Vec<ExtractedMatchValue>>(&matches, operation_id),
        Err(e) => CallbackEvent::OperationError {
            uuid: operation_id,
            error: e,
        },
    }
}

fn result_to_callback_event<T>(v: &T, operation_id: Uuid) -> CallbackEvent
where
    T: Serialize,
{
    match serde_json::to_string(v) {
        Ok(serialized) => CallbackEvent::OperationDone(OperationDone {
            uuid: operation_id,
            result: Some(serialized),
        }),
        Err(err) => CallbackEvent::OperationError {
            uuid: operation_id,
            error: NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some(format!("{}", err)),
            },
        },
    }
}

#[allow(clippy::too_many_arguments)]
async fn handle_concat(
    operation_id: Uuid,
    config_file: &Path,
    out_path: &Path,
    append: bool,
    source_type: SupportedFileType,
    source_id: String,
    state: &Arc<Mutex<SessionState>>,
    cancellation_token: CancellationToken,
) -> CallbackEvent {
    let (tx, _rx) = cc::unbounded();
    match concat_files_use_config_file(config_file, out_path, append, 500, tx, None) {
        Ok(()) => {
            match handle_assign(out_path, source_type, source_id, state, cancellation_token) {
                Ok(Some(line_count)) => CallbackEvent::StreamUpdated(line_count),
                Ok(None) => CallbackEvent::Progress {
                    uuid: operation_id,
                    progress: Progress::Stopped,
                },
                Err(error) => CallbackEvent::OperationError {
                    uuid: operation_id,
                    error,
                },
            }
        }
        Err(err) => CallbackEvent::OperationError {
            uuid: operation_id,
            error: NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::OperationSearch,
                message: Some(format!("Failed to concatenate files: {}", err)),
            },
        },
    }
}

/// assign a file initially by creating the meta for it and sending it as metadata update
/// for the content grabber (current_grabber)
/// if the metadata was successfully created, we return the line count of it
/// if the operation was stopped, we return None
fn handle_assign(
    file_path: &Path,
    source_type: SupportedFileType,
    source_id: String,
    state: &Arc<Mutex<SessionState>>,
    cancellation_token: CancellationToken,
) -> Result<Option<u64>, NativeError> {
    match create_metadata_for_source(file_path, source_type, source_id) {
        Ok(ComputationResult::Item(metadata)) => {
            trace!("received metadata {:?}", metadata);
            debug!("RUST: received metadata");
            let line_count: u64 = metadata.line_count as u64;
            match update_state(state, Some(line_count), Some(Some(metadata))) {
                Some(()) => Ok(Some(line_count)),
                None => Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::OperationSearch,
                    message: Some("Failed to write stream len".to_string()),
                }),
            }
        }
        Ok(ComputationResult::Stopped) => {
            info!("RUST: metadata calculation aborted");
            let _ = update_state(state, None, Some(None));
            Ok(None)
        }
        Err(e) => {
            warn!("RUST error computing metadata: {}", e);
            let _ = update_state(state, None, Some(None));
            Err(e.into())
        }
    }
}

fn update_state(
    state: &Arc<Mutex<SessionState>>,
    stream_len: Option<u64>,
    metadata: Option<Option<GrabMetadata>>,
) -> Option<()> {
    match state.lock() {
        Ok(mut state) => {
            if let Some(stream_len) = stream_len {
                state.search_map.set_stream_len(stream_len);
            }
            if let Some(metadata) = metadata {
                state.metadata = metadata;
            }
            Some(())
        }
        Err(_) => None,
    }
}

fn parse_operation_id(operation_id: &str) -> Result<Uuid, ComputationError> {
    match Uuid::parse_str(operation_id) {
        Ok(uuid) => Ok(uuid),
        Err(e) => Err(ComputationError::Process(format!(
            "Fail to parse operation uuid from {}. Error: {}",
            operation_id, e
        ))),
    }
}

fn handle_search(
    target_file: PathBuf,
    filters: Vec<SearchFilter>,
    operation_id: Uuid,
    search_metadata_tx: &cc::Sender<Option<(PathBuf, GrabMetadata)>>,
    state: &Arc<Mutex<SessionState>>,
) -> Vec<CallbackEvent> {
    debug!("RUST: Search operation is requested");
    if filters.is_empty() {
        debug!("RUST: Search will be dropped. Filters are empty");
        // This is dropping of search
        let _ = search_metadata_tx.send(None);
        vec![
            CallbackEvent::SearchUpdated(0),
            result_to_callback_event(
                &SearchOperationResult {
                    found: 0,
                    stats: FilterStats::new(vec![]),
                },
                operation_id,
            ),
        ]
    } else {
        let search_results = run_search(&target_file, filters.iter(), state);
        match search_results {
            Ok((file_path, found, stats)) => {
                if found == 0 {
                    let _ = search_metadata_tx.send(None);
                    vec![
                        CallbackEvent::SearchUpdated(0),
                        result_to_callback_event(
                            &SearchOperationResult { found, stats },
                            operation_id,
                        ),
                    ]
                } else {
                    let source = TextFileSource::new(&file_path, "search_results");
                    let metadata_res = source.from_file(None);
                    match metadata_res {
                        Ok(ComputationResult::Item(metadata)) => {
                            debug!("RUST: received search metadata");
                            let line_count = metadata.line_count as u64;
                            let _ = search_metadata_tx.send(Some((file_path, metadata)));
                            vec![
                                CallbackEvent::SearchUpdated(line_count),
                                result_to_callback_event(
                                    &SearchOperationResult { found, stats },
                                    operation_id,
                                ),
                            ]
                        }
                        Ok(ComputationResult::Stopped) => {
                            debug!("RUST: search metadata calculation aborted");
                            vec![CallbackEvent::Progress {
                                uuid: operation_id,
                                progress: Progress::Stopped,
                            }]
                        }
                        Err(e) => {
                            let err_msg = format!("RUST error computing search metadata: {:?}", e);
                            vec![CallbackEvent::OperationError {
                                uuid: operation_id,
                                error: NativeError {
                                    severity: Severity::WARNING,
                                    kind: NativeErrorKind::ComputationFailed,
                                    message: Some(err_msg),
                                },
                            }]
                        }
                    }
                }
            }
            Err(e) => vec![CallbackEvent::OperationError {
                uuid: operation_id,
                error: e,
            }],
        }
    }
}
