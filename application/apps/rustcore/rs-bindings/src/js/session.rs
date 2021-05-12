use crate::js::events::{
    AsyncBroadcastChannel, CallbackEvent, ComputationError, NativeError, NativeErrorKind,
    OperationDone, SearchOperationResult, SyncChannel,
};
use crossbeam_channel as cc;
use indexer_base::progress::{ComputationResult, ComputationResult::Item, Progress, Severity};
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
    grabber::{GrabError, GrabMetadata, GrabTrait, GrabbedContent, LineRange, MetadataSource},
    map::SearchMap,
    search::{SearchFilter, SearchHolder},
    text_source::TextFileSource,
};
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    thread,
};
use tokio::{runtime::Runtime, sync::broadcast};
use uuid::Uuid;

pub struct SessionState {
    pub assigned_file: Option<String>,
    pub filters: Vec<SearchFilter>,
    pub search_map: SearchMap,
}

#[derive(Debug, Serialize, Clone)]
enum Operation {
    Assign {
        file_path: String,
        source_id: String,
        operation_id: Uuid,
        source_type: SupportedFileType,
    },
    Search {
        target_file: PathBuf,
        filters: Vec<SearchFilter>,
        operation_id: Uuid,
    },
    Map {
        dataset_len: u16,
        range: Option<(u64, u64)>,
        operation_id: Uuid,
    },
    End,
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

pub struct RustSession {
    pub id: String,
    pub running: bool,
    pub content_grabber: Option<Box<dyn GrabTrait>>,
    pub search_grabber: Option<Box<dyn GrabTrait>>,
    pub state: Arc<Mutex<SessionState>>,
    // TODO: think about if we need to keep a callback around
    // callback: Option<Box<dyn Fn(CallbackEvent) + Send + 'static>>,
    op_channel: AsyncBroadcastChannel<Operation>,
    // channel that allows to propagate shutdown requests to ongoing operations
    shutdown_channel: AsyncBroadcastChannel<()>,
    // channel to store the metadata of a file once available
    content_metadata_channel: SyncChannel<Result<Option<GrabMetadata>, ComputationError>>,
    // channel to store the metadata of the search results once available
    search_metadata_channel: SyncChannel<(PathBuf, GrabMetadata)>,
    // search_metadata_channel: AsyncChannel<Result<Option<GrabMetadata>, ComputationError>>,
}

impl RustSession {
    /// will result in a grabber that has it's metadata generated
    /// this function will first check if there has been some new metadata that was previously
    /// written to the metadata-channel. If so, this metadata is used in the grabber.
    /// If there was no new metadata, we make sure that the metadata has been set.
    /// If no metadata is available, an error is returned. That means that assign was not completed before.
    fn get_content_grabber(&mut self) -> Result<&mut Box<dyn GrabTrait>, ComputationError> {
        let current_grabber = match &mut self.content_grabber {
            Some(c) => Ok(c),
            None => Err(ComputationError::Protocol(
                "Need a grabber first to work with metadata".to_owned(),
            )),
        }?;
        let fresh_metadata_result = match self.content_metadata_channel.1.try_recv() {
            Ok(new_metadata) => {
                if let Ok(Some(md)) = &new_metadata {
                    println!("RUST: new metadata arrived: {} lines", md.line_count);
                }
                Ok(Some(new_metadata))
            }
            Err(cc::TryRecvError::Empty) => {
                println!("RUST: no new metadata arrived");
                Ok(None)
            }
            Err(cc::TryRecvError::Disconnected) => Err(ComputationError::Protocol(
                "Metadata channel was disconnected".to_owned(),
            )),
        };
        let grabber = match fresh_metadata_result {
            Ok(Some(res)) => {
                println!("RUST: Trying to use new results");
                match res {
                    Ok(Some(metadata)) => {
                        println!("RUST: setting new metadata into content_grabber");
                        current_grabber
                            .inject_metadata(metadata)
                            .map_err(|e| ComputationError::Process(format!("{:?}", e)))?;
                        Ok(current_grabber)
                    }
                    Ok(None) => Err(ComputationError::Process(
                        "No metadata available".to_owned(),
                    )),
                    Err(e) => Err(ComputationError::Protocol(format!(
                        "Problems during metadata generation: {}",
                        e
                    ))),
                }
            }
            Ok(None) => match current_grabber.get_metadata() {
                Some(_) => {
                    println!("RUST: reusing cached metadata");
                    Ok(current_grabber)
                }
                None => Err(ComputationError::Protocol(
                    "No metadata available for grabber".to_owned(),
                )),
            },
            Err(e) => Err(e),
        }?;
        Ok(grabber)
    }

    fn get_search_grabber(&mut self) -> Result<Option<&mut Box<dyn GrabTrait>>, ComputationError> {
        if self.search_grabber.is_none() {
            match self.search_metadata_channel.1.try_recv() {
                Ok((file_path, metadata)) => {
                    type GrabberType = processor::grabber::Grabber<TextFileSource>;
                    let source = TextFileSource::new(&file_path, "search_results");
                    let mut grabber = match GrabberType::new(source) {
                        Ok(grabber) => grabber,
                        Err(err) => {
                            return Err(ComputationError::Protocol(format!(
                                "Fail to create search grabber. Error: {}",
                                err
                            )));
                        }
                    };
                    if let Err(err) = grabber.inject_metadata(metadata) {
                        return Err(ComputationError::Protocol(format!(
                            "Fail to inject metadata into search grabber. Error: {}",
                            err
                        )));
                    }
                    self.search_grabber = Some(Box::new(grabber));
                }
                Err(cc::TryRecvError::Empty) => {
                    println!("RUST: no new search metadata arrived");
                    return Ok(None);
                }
                Err(cc::TryRecvError::Disconnected) => {
                    return Err(ComputationError::Protocol(
                        "Search metadata channel was disconnected".to_owned(),
                    ));
                }
            };
        }
        let grabber = match &mut self.search_grabber {
            Some(c) => Ok(c),
            None => Err(ComputationError::Protocol(
                "Search grabber channel was disconnected".to_owned(),
            )),
        }?;
        match grabber.get_metadata() {
            Some(_) => {
                println!("RUST: reusing cached metadata");
                Ok(Some(grabber))
            }
            None => Err(ComputationError::Protocol(
                "No metadata available for grabber".to_owned(),
            )),
        }
    }
}

#[node_bindgen]
impl RustSession {
    #[node_bindgen(constructor)]
    pub fn new(id: String) -> Self {
        // init_logging();
        Self {
            id,
            running: false,
            state: Arc::new(Mutex::new(SessionState {
                assigned_file: None,
                filters: vec![],
                search_map: SearchMap::new(),
            })),
            content_grabber: None,
            search_grabber: None,
            shutdown_channel: broadcast::channel(1),
            op_channel: broadcast::channel(10),
            content_metadata_channel: cc::bounded(1),
            search_metadata_channel: cc::bounded(1),
        }
    }

    #[node_bindgen(getter)]
    fn id(&self) -> String {
        println!("value");
        self.id.clone()
    }

    #[node_bindgen]
    fn cancel_operations(&mut self) -> Result<(), ComputationError> {
        let _ = self.shutdown_channel.0.send(());
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
        // self.callback = Some(Box::new(callback));
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {}", e))
        })?;
        let mut event_stream = self.op_channel.0.subscribe();
        self.running = true;
        let shutdown_tx = self.shutdown_channel.0.clone();
        let content_metadata_tx = self.content_metadata_channel.0.clone();
        let search_metadata_tx = self.search_metadata_channel.0.clone();
        let state = Arc::clone(&self.state);
        thread::spawn(move || {
            rt.block_on(async {
                println!("RUST: running runtime");
                loop {
                    match event_stream.recv().await {
                        Ok(op_event) => match op_event {
                            Operation::Assign {
                                file_path,
                                source_id,
                                operation_id,
                                source_type,
                            } => {
                                println!("RUST: received Assign operation event");
                                match create_metadata_for_source(file_path, source_type, source_id)
                                {
                                    Some(Ok(Item(metadata))) => {
                                        println!("RUST: received metadata");
                                        let line_count: u64 = metadata.line_count as u64;
                                        let _ = content_metadata_tx.send(Ok(Some(metadata)));
                                        match state.lock() {
                                            Ok(mut state) => {
                                                state.search_map.set_stream_len(line_count)
                                            }
                                            Err(err) => {
                                                callback(CallbackEvent::OperationError((
                                                    operation_id,
                                                    NativeError {
                                                        severity: Severity::ERROR,
                                                        kind: NativeErrorKind::OperationSearch,
                                                        message: Some(format!(
                                                            "Fail write stream len. Error: {}",
                                                            err
                                                        )),
                                                    },
                                                )));
                                                continue;
                                            }
                                        };
                                        callback(CallbackEvent::StreamUpdated(line_count));
                                    }
                                    Some(Ok(_)) => {
                                        println!("RUST: metadata calculation aborted");
                                        let _ = content_metadata_tx.send(Ok(None));
                                    }
                                    Some(Err(e)) => {
                                        println!("RUST error computing metadata");
                                        let _ = content_metadata_tx.send(Err(
                                            ComputationError::Process(format!(
                                                "Could not compute metadata: {}",
                                                e
                                            )),
                                        ));
                                        callback(CallbackEvent::OperationError((
                                            operation_id,
                                            NativeError {
                                                severity: Severity::WARNING,
                                                kind: NativeErrorKind::ComputationFailed,
                                                message: None,
                                            },
                                        )));
                                    }
                                    None => callback(CallbackEvent::OperationError((
                                        operation_id,
                                        NativeError {
                                            severity: Severity::WARNING,
                                            kind: NativeErrorKind::UnsupportedFileType,
                                            message: None,
                                        },
                                    ))),
                                }
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
                                println!("RUST: Search operation is requested");
                                match run_search(&target_file, filters.iter(), &state) {
                                    Ok((file_path, found, stats)) => {
                                        if found == 0 {
                                            callback(CallbackEvent::SearchUpdated(0));
                                        } else {
                                            let source =
                                                TextFileSource::new(&file_path, "search_results");
                                            let metadata_res = source.from_file(None);
                                            match metadata_res {
                                                Ok(Item(metadata)) => {
                                                    println!("RUST: received search metadata");
                                                    let line_count: u64 =
                                                        metadata.line_count as u64;
                                                    let _ = search_metadata_tx
                                                        .send((file_path, metadata));
                                                    callback(CallbackEvent::SearchUpdated(
                                                        line_count,
                                                    ));
                                                }
                                                Ok(_) => {
                                                    println!("RUST: search metadata calculation aborted");
                                                    callback(CallbackEvent::Progress((
                                                        operation_id,
                                                        Progress::Stopped
                                                    )));
                                                }
                                                Err(e) => {
                                                    let err_msg = format!("RUST error computing search metadata: {:?}", e);
                                                    callback(CallbackEvent::OperationError((
                                                        operation_id,
                                                        NativeError {
                                                            severity: Severity::WARNING,
                                                            kind:
                                                                NativeErrorKind::ComputationFailed,
                                                            message: Some(err_msg),
                                                        },
                                                    )));
                                                }
                                            }
                                        }
                                        callback(as_callback_event(
                                            &SearchOperationResult {
                                                found,
                                                stats,
                                            }, operation_id));
                                    }
                                    Err(e) => {
                                        callback(CallbackEvent::OperationError((operation_id, e)));
                                        continue;
                                    }
                                }
                            }
                            Operation::Map {
                                dataset_len,
                                range,
                                operation_id,
                            } => {
                                println!("RUST: received Map operation event");
                                match state.lock() {
                                    Ok(state) => {
                                        callback(as_callback_event(
                                            &&(state.search_map.get(dataset_len, range)), operation_id));
                                    }
                                    Err(err) => {
                                        callback(CallbackEvent::OperationError((
                                            operation_id,
                                            NativeError {
                                                severity: Severity::ERROR,
                                                kind: NativeErrorKind::OperationSearch,
                                                message: Some(format!(
                                                    "Fail write search map. Error: {}",
                                                    err
                                                )),
                                            },
                                        )));
                                        continue;
                                    }
                                };
                                callback(CallbackEvent::OperationDone(OperationDone {
                                    uuid: operation_id,
                                    result: None,
                                }));
                            }
                            Operation::End => {
                                println!("RUST: received End operation event");
                                callback(CallbackEvent::SessionDestroyed);
                                break;
                            }
                        },
                        Err(e) => {
                            println!("Rust: error on channel: {}", e);
                            break;
                        }
                    }
                }
                println!("RUST: exiting runtime");
            })
        });
        Ok(())
    }

    #[node_bindgen]
    fn get_stream_len(&mut self) -> Result<i64, ComputationError> {
        match &self.get_content_grabber()?.get_metadata() {
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
            Some(md) => Ok(md.line_count as i64 - 1),
            None => Ok(0),
        }
    }

    #[node_bindgen]
    fn grab(
        &mut self,
        start_line_index: i64, // TODO: Check for nodebindget support for u64
        number_of_lines: i64,
    ) -> Result<String, ComputationError> {
        println!(
            "RUST: grab from {} ({} lines)",
            start_line_index, number_of_lines
        );
        let grabbed_content = self
            .get_content_grabber()?
            .grab_content(&LineRange::from(
                (start_line_index as u64)..=((start_line_index + number_of_lines - 1) as u64),
            ))
            .map_err(|e| ComputationError::Communication(format!("{}", e)))?;
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
    fn assign(&mut self, file_path: String, source_id: String) -> Result<String, ComputationError> {
        println!("RUST: send assign event on channel");
        let operation_id = Uuid::new_v4();
        let input_p = PathBuf::from(&file_path);
        let source_type = match get_supported_file_type(&input_p) {
            Some(SupportedFileType::Text) => {
                type GrabberType = processor::grabber::Grabber<TextFileSource>;
                let source = TextFileSource::new(&input_p, &source_id);
                let grabber = GrabberType::new(source).map_err(|e| {
                    ComputationError::Process(format!("Could not create grabber: {}", e))
                })?;
                self.content_grabber = Some(Box::new(grabber));
                SupportedFileType::Text
            }
            Some(SupportedFileType::Dlt) => {
                type GrabberType = processor::grabber::Grabber<DltSource>;
                let source = DltSource::new(&input_p, &source_id);
                let grabber = GrabberType::new(source).map_err(|e| {
                    ComputationError::Process(format!("Could not create grabber: {}", e))
                })?;
                self.content_grabber = Some(Box::new(grabber));
                SupportedFileType::Dlt
            }
            None => {
                return Err(ComputationError::OperationNotSupported(
                    "Unsupported file type".to_string(),
                ));
            }
        };
        self.op_channel
            .0
            .send(Operation::Assign {
                file_path,
                source_id,
                operation_id,
                source_type,
            })
            .map_err(|_| {
                ComputationError::Process("Could not send operation on channel".to_string())
            })?;
        Ok(operation_id.to_string())
    }

    #[node_bindgen]
    fn grab_search(
        &mut self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationError> {
        println!(
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
                (start_line_index as u64)..=((start_line_index + number_of_lines - 1) as u64),
            ))
            .map_err(|e| ComputationError::Communication(format!("{}", e)))?;
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
                        to_pos = pos;
                    } else if to_pos + 1 != pos {
                        ranges.push(std::ops::RangeInclusive::new(from_pos - 1, to_pos - 1));
                        from_pos = pos;
                        to_pos = pos;
                    } else {
                        to_pos = pos;
                    }
                }
                Err(e) => {
                    return Err(ComputationError::Process(format!("{}", e)));
                }
            }
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from_pos)
            || (ranges.is_empty() && !grabbed_content.grabbed_elements.is_empty())
        {
            ranges.push(std::ops::RangeInclusive::new(from_pos - 1, to_pos - 1));
        }
        let mut row: usize = start_line_index as usize;
        for range in ranges.iter() {
            let mut original_content = self
                .get_content_grabber()?
                .grab_content(&LineRange::from(range.clone()))
                .map_err(|e| ComputationError::Communication(format!("{}", e)))?;
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
        println!(
            "RUST: grabbing search result from original content {} rows",
            results.grabbed_elements.len()
        );
        //println!("RUST: grabbing search result from original content. Ranges: {:?}", ranges);
        //println!("RUST: grabbing search result from original content. Elements: {:?}", results.grabbed_elements);
        let serialized =
            serde_json::to_string(&results).map_err(|_| ComputationError::InvalidData)?;
        Ok(serialized)
    }

    #[node_bindgen]
    fn search(&mut self, filters: Vec<WrappedSearchFilter>) -> Result<String, ComputationError> {
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
            return Err(ComputationError::NoAssignedContent);
        };
        let operation_id = Uuid::new_v4();
        let filters: Vec<SearchFilter> = filters.iter().map(|f| f.as_filter()).collect();
        println!(
            "Search (operation: {}) will be done in {:?} withing next fileters: {:?}",
            operation_id, target_file, filters
        );
        if let Err(e) = self
            .op_channel
            .0
            .send(Operation::Search {
                target_file,
                operation_id,
                filters,
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
    fn get_map(
        &mut self,
        dataset_len: i32,
        from: i64,
        to: i64,
    ) -> Result<String, ComputationError> {
        let operation_id = Uuid::new_v4();
        let mut range: Option<(u64, u64)> = None;
        if from > 0 && to > 0 && from > to {
            range = Some((from as u64, to as u64));
        }
        println!(
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
                Ok(value) => {
                    if let Some(value) = value {
                        match value.as_value::<String>() {
                            Ok(s) => s,
                            Err(e) => {
                                return Err(e);
                            }
                        }
                    } else {
                        return Err(NjError::Other("[value] property is not found".to_owned()));
                    }
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let is_regex: bool = match js_obj.get_property("is_regex") {
                Ok(value) => {
                    if let Some(value) = value {
                        match value.as_value::<bool>() {
                            Ok(s) => s,
                            Err(e) => {
                                return Err(e);
                            }
                        }
                    } else {
                        return Err(NjError::Other(
                            "[is_regex] property is not found".to_owned(),
                        ));
                    }
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let is_word: bool = match js_obj.get_property("is_word") {
                Ok(value) => {
                    if let Some(value) = value {
                        match value.as_value::<bool>() {
                            Ok(s) => s,
                            Err(e) => {
                                return Err(e);
                            }
                        }
                    } else {
                        return Err(NjError::Other("[is_word] property is not found".to_owned()));
                    }
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let ignore_case: bool = match js_obj.get_property("ignore_case") {
                Ok(value) => {
                    if let Some(value) = value {
                        match value.as_value::<bool>() {
                            Ok(s) => s,
                            Err(e) => {
                                return Err(e);
                            }
                        }
                    } else {
                        return Err(NjError::Other(
                            "[ignore_case] property is not found".to_owned(),
                        ));
                    }
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
    file_path: String,
    source_type: SupportedFileType,
    source_id: String,
) -> Option<Result<ComputationResult<GrabMetadata>, GrabError>> {
    let file_path = Path::new(&file_path);
    match source_type {
        SupportedFileType::Dlt => {
            let source = DltSource::new(file_path, &source_id);
            Some(source.from_file(None))
        }
        SupportedFileType::Text => {
            let source = TextFileSource::new(file_path, &source_id);
            Some(source.from_file(None))
        }
    }
}

fn run_search<'a, I>(
    target_file_path: &Path,
    filters: I,
    state: &Arc<Mutex<SessionState>>,
) -> Result<(PathBuf, usize, Vec<(u8, u64)>), NativeError>
where
    I: Iterator<Item = &'a SearchFilter>,
{
    let search_holder = SearchHolder::new(&target_file_path, filters);
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

fn as_callback_event<T>(v: &T, operation_id: Uuid) -> CallbackEvent
where
    T: Serialize,
{
    match serde_json::to_string(v) {
        Ok(serialized) => CallbackEvent::OperationDone(OperationDone {
            uuid: operation_id,
            result: Some(serialized),
        }),
        Err(err) => CallbackEvent::OperationError((
            operation_id,
            NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some(format!("{}", err)),
            },
        )),
    }
}
