pub mod events;

use crate::{
    js::{
        converting::{
            concat::WrappedConcatenatorInput, filter::WrappedSearchFilter,
            merge::WrappedFileMergeOptions,
        },
        session::events::{callback_event_loop, ComputationErrorWrapper},
    },
    logging::targets,
};
use crossbeam_channel as cc;
use events::CallbackEventWrapper;
use log::{debug, error, info, warn};
use node_bindgen::derive::node_bindgen;
use processor::{
    grabber::{factory::create_lazy_grabber, GrabbedContent, LineRange},
    search::{SearchError, SearchFilter},
};
use session::{
    events::{CallbackEvent, ComputationError, NativeError},
    operations,
    session::{OperationsChannel, Session},
    state::{self, SessionStateAPI},
};
use std::{fs::OpenOptions, path::PathBuf, thread};
use tokio::{
    join,
    runtime::Runtime,
    sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
};
use uuid::Uuid;

struct RustSession(Session);

#[node_bindgen]
impl RustSession {
    #[node_bindgen(constructor)]
    pub fn new(id: String) -> Self {
        let (tx_operations, rx_operations): OperationsChannel = unbounded_channel();
        let (state_api, rx_state_api) = SessionStateAPI::new();
        Self(Session {
            id,
            running: false,
            content_grabber: None,
            search_grabber: None,
            tx_operations,
            rx_operations: Some(rx_operations),
            rx_state_api: Some(rx_state_api),
            state_api: Some(state_api),
            search_metadata_channel: cc::unbounded(),
        })
    }

    #[node_bindgen(getter)]
    fn id(&self) -> String {
        self.0.id.clone()
    }

    #[node_bindgen]
    fn abort(
        &mut self,
        operation_id: String,
        target_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        let _ = self.0.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Cancel {
                target: operations::uuid_from_str(&target_id)?,
            },
        ));
        Ok(())
    }

    /// this will start of the event loop that processes different rust operations
    /// in the event-loop-thread
    /// the callback is used to report back to javascript
    #[node_bindgen(mt)]
    fn start<F: Fn(CallbackEventWrapper) + Send + 'static>(
        &mut self,
        callback: F,
    ) -> Result<(), ComputationErrorWrapper> {
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {}", e))
        })?;
        let rx_operations = if let Some(rx_operations) = self.0.rx_operations.take() {
            rx_operations
        } else {
            return Err(ComputationError::MultipleInitCall.into());
        };
        self.0.running = true;
        let state_api = if let Some(state_api) = self.0.state_api.as_ref() {
            state_api.clone()
        } else {
            return Err(ComputationError::MultipleInitCall.into());
        };
        let rx_state_api = if let Some(rx_state_api) = self.0.rx_state_api.take() {
            rx_state_api
        } else {
            return Err(ComputationError::MultipleInitCall.into());
        };
        let search_metadata_tx = self.0.search_metadata_channel.0.clone();
        thread::spawn(move || {
            rt.block_on(async {
                info!(target: targets::SESSION, "started");
                let (tx_callback_events, rx_callback_events): (
                    UnboundedSender<CallbackEvent>,
                    UnboundedReceiver<CallbackEvent>,
                ) = unbounded_channel();
                let state_shutdown_token = state_api.get_shutdown_token();
                let (_, _) = join!(
                    async move {
                        let (_, _) = join!(
                            operations::task(
                                rx_operations,
                                state_api.clone(),
                                search_metadata_tx,
                                tx_callback_events
                            ),
                            callback_event_loop(callback, rx_callback_events),
                        );
                        if let Err(err) = state_api.shutdown() {
                            error!(
                                target: targets::SESSION,
                                "fail to call state shutdown: {:?}", err
                            );
                        }
                    },
                    state::task(rx_state_api, state_shutdown_token),
                );
                info!(target: targets::SESSION, "finished");
            })
        });
        Ok(())
    }

    #[node_bindgen]
    async fn get_stream_len(&mut self) -> Result<i64, ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        match &self.0.get_updated_content_grabber().await?.get_metadata() {
            Some(md) => Ok(md.line_count as i64),
            None => Err(ComputationError::Protocol("Cannot happen".to_owned()).into()),
        }
    }

    #[node_bindgen]
    async fn get_search_len(&mut self) -> Result<i64, ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        let grabber = if let Some(grabber) = self.0.get_search_grabber()? {
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
    async fn grab(
        &mut self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        info!(
            target: targets::SESSION,
            "grab from {} ({} lines)", start_line_index, number_of_lines
        );
        let grabbed_content = self
            .0
            .get_updated_content_grabber()
            .await?
            .grab_content(&LineRange::from(
                (start_line_index as u64)..=((start_line_index + number_of_lines - 1) as u64),
            ))
            .map_err(|e| ComputationError::Communication(format!("grab content failed: {}", e)))?;
        let serialized =
            serde_json::to_string(&grabbed_content).map_err(|_| ComputationError::InvalidData)?;
        Ok(serialized)
    }

    #[node_bindgen]
    fn stop(&mut self, operation_id: String) -> Result<(), ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        let _ = self.0.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::End,
        ));
        self.0.running = false;
        Ok(())
    }

    #[node_bindgen]
    async fn assign(
        &mut self,
        file_path: String,
        source_id: String,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        debug!(target: targets::SESSION, "send assign event on channel");
        let input_p = PathBuf::from(&file_path);
        let boxed_grabber =
            create_lazy_grabber(&input_p, &source_id).map_err(ComputationError::from)?;
        self.0.content_grabber = Some(boxed_grabber);
        match self.0.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Assign { file_path: input_p },
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))
            .into()),
        }
    }

    #[node_bindgen]
    async fn grab_search(
        &mut self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        info!(
            target: targets::SESSION,
            "grab search results from {} ({} lines)", start_line_index, number_of_lines
        );
        let grabber = if let Some(grabber) = self.0.get_search_grabber()? {
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
                warn!(
                    target: targets::SESSION,
                    "Grab search content failed: {}", e
                );
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
                    return Err(ComputationError::Process(format!("{}", e)).into());
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
                .0
                .get_updated_content_grabber()
                .await?
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
            target: targets::SESSION,
            "grabbing search result from original content {} rows",
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
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        self.0.search_grabber = None;
        let (tx_response, rx_response): (cc::Sender<()>, cc::Receiver<()>) = cc::bounded(1);
        self.0
            .tx_operations
            .send((
                Uuid::new_v4(),
                operations::Operation::DropSearch(tx_response),
            ))
            .map_err(|e| ComputationError::Process(e.to_string()))?;
        if let Err(err) = rx_response.recv() {
            return Err(ComputationError::Process(format!(
                "Cannot drop search map. Error: {}",
                err
            ))
            .into());
        }
        let target_file = if let Some(content) = self.0.content_grabber.as_ref() {
            content.as_ref().associated_file()
        } else {
            warn!(
                target: targets::SESSION,
                "Cannot search when no file has been assigned"
            );
            return Err(ComputationError::NoAssignedContent.into());
        };
        let filters: Vec<SearchFilter> = filters.iter().map(|f| f.as_filter()).collect();
        info!(
            target: targets::SESSION,
            "Search (operation: {}) will be done in {:?} withing next filters: {:?}",
            operation_id,
            target_file,
            filters
        );
        match self.0.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Search {
                target_file,
                filters,
            },
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))
            .into()),
        }
    }

    #[node_bindgen]
    async fn extract_matches(
        &mut self,
        filters: Vec<WrappedSearchFilter>,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        let target_file = if let Some(content) = self.0.content_grabber.as_ref() {
            content.as_ref().associated_file()
        } else {
            return Err(ComputationError::NoAssignedContent.into());
        };
        let filters: Vec<SearchFilter> = filters.iter().map(|f| f.as_filter()).collect();
        info!(
            target: targets::SESSION,
            "Extract (operation: {}) will be done in {:?} withing next filters: {:?}",
            operation_id,
            target_file,
            filters
        );
        match self
            .0
            .tx_operations
            .send((
                operations::uuid_from_str(&operation_id)?,
                operations::Operation::Extract {
                    target_file,
                    filters,
                },
            ))
            .map_err(|_| {
                ComputationError::Process("Could not send operation on channel".to_string())
            }) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))
            .into()),
        }
    }

    #[node_bindgen]
    async fn get_map(
        &mut self,
        operation_id: String,
        dataset_len: i32,
        from: Option<i64>,
        to: Option<i64>,
    ) -> Result<String, ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        let mut range: Option<(u64, u64)> = None;
        if let Some(from) = from {
            if let Some(to) = to {
                if from >= 0 && to >= 0 {
                    if from <= to {
                        range = Some((from as u64, to as u64));
                    } else {
                        warn!(
                            target: targets::SESSION,
                            "Invalid range (operation: {}): from = {}; to = {}",
                            operation_id,
                            from,
                            to
                        );
                    }
                }
            }
        }
        info!(
            target: targets::SESSION,
            "Map requested (operation: {}). Range: {:?}", operation_id, range
        );
        if let Err(e) = self
            .0
            .tx_operations
            .send((
                operations::uuid_from_str(&operation_id)?,
                operations::Operation::Map {
                    dataset_len: dataset_len as u16,
                    range,
                },
            ))
            .map_err(|_| {
                ComputationError::Process("Could not send operation on channel".to_string())
            })
        {
            return Err(e.into());
        }
        Ok(operation_id)
    }

    #[node_bindgen]
    async fn get_nearest_to(
        &mut self,
        operation_id: String,
        position_in_stream: i64,
    ) -> Result<(), ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        self.0
            .tx_operations
            .send((
                operations::uuid_from_str(&operation_id)?,
                operations::Operation::GetNearestPosition(position_in_stream as u64),
            ))
            .map_err(|e| ComputationError::Process(e.to_string()))?;
        Ok(())
    }

    #[node_bindgen]
    async fn concat(
        &mut self,
        files: Vec<WrappedConcatenatorInput>,
        append: bool,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        //TODO: out_path should be gererics by some settings.
        let (out_path, out_path_str) = if files.is_empty() {
            return Err(ComputationError::InvalidData.into());
        } else {
            let filename = PathBuf::from(&files[0].as_concatenator_input().path);
            if let Some(parent) = filename.parent() {
                if let Some(file_name) = filename.file_name() {
                    let path = parent.join(format!("{}.concat", file_name.to_string_lossy()));
                    (path.clone(), path.to_string_lossy().to_string())
                } else {
                    return Err(ComputationError::InvalidData.into());
                }
            } else {
                return Err(ComputationError::InvalidData.into());
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
        let boxed_grabber =
            create_lazy_grabber(&out_path, &out_path_str).map_err(ComputationError::from)?;
        self.0.content_grabber = Some(boxed_grabber);
        match self.0.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Concat {
                files: files
                    .iter()
                    .map(|file| file.as_concatenator_input())
                    .collect(),
                out_path,
                append,
                source_id: out_path_str,
            },
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))
            .into()),
        }
    }

    #[node_bindgen]
    async fn merge(
        &mut self,
        files: Vec<WrappedFileMergeOptions>,
        append: bool,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        //TODO: out_path should be gererics by some settings.
        let (out_path, out_path_str) = if files.is_empty() {
            return Err(ComputationError::InvalidData.into());
        } else {
            let filename = PathBuf::from(&files[0].as_file_merge_options().path);
            if let Some(parent) = filename.parent() {
                if let Some(file_name) = filename.file_name() {
                    let path = parent.join(format!("{}.merged", file_name.to_string_lossy()));
                    (path.clone(), path.to_string_lossy().to_string())
                } else {
                    return Err(ComputationError::InvalidData.into());
                }
            } else {
                return Err(ComputationError::InvalidData.into());
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
        let boxed_grabber =
            create_lazy_grabber(&out_path, &out_path_str).map_err(ComputationError::from)?;
        self.0.content_grabber = Some(boxed_grabber);
        match self.0.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Merge {
                files: files
                    .iter()
                    .map(|file| file.as_file_merge_options())
                    .collect(),
                out_path,
                append,
                source_id: out_path_str,
            },
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))
            .into()),
        }
    }

    #[node_bindgen]
    async fn set_debug(&mut self, debug: bool) -> Result<(), ComputationErrorWrapper> {
        if let Some(state) = self.0.state_api.as_ref() {
            state
                .set_debug(debug)
                .await
                .map_err(|e: NativeError| ComputationError::NativeError(e).into())
        } else {
            Err(ComputationError::SessionUnavailable.into())
        }
    }

    #[node_bindgen]
    async fn get_operations_stat(&mut self) -> Result<String, ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        if let Some(state) = self.0.state_api.as_ref() {
            state
                .get_operations_stat()
                .await
                .map_err(|e: NativeError| ComputationError::NativeError(e).into())
        } else {
            Err(ComputationError::SessionUnavailable.into())
        }
    }

    #[node_bindgen]
    async fn sleep(
        &mut self,
        operation_id: String,
        ms: i64,
    ) -> Result<(), ComputationErrorWrapper> {
        if !self.0.is_opened() {
            return Err(ComputationError::SessionUnavailable.into());
        }
        match self.0.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Sleep(ms as u64),
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))
            .into()),
        }
    }
}
