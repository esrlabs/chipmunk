//! Includes functionalities needed for handling one logs session, from starting it
//! to listening to incoming operations and updating the state, to destroying it at the end.

use crate::{
    operations,
    operations::Operation,
    state,
    state::{IndexesMode, SessionStateAPI},
    tracker,
    tracker::OperationTrackerAPI,
};
use futures::Future;
use log::{debug, error, warn};
use processor::{grabber::LineRange, search::filter::SearchFilter};
use std::{ops::RangeInclusive, path::PathBuf};
use tokio::{
    join,
    sync::{
        mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel},
        oneshot,
    },
    task::{self, JoinHandle},
    time,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub type OperationsChannel = (UnboundedSender<Operation>, UnboundedReceiver<Operation>);

pub const SHUTDOWN_TIMEOUT_IN_MS: u64 = 2000;

#[derive(Debug)]
pub struct Session {
    uuid: Uuid,
    tx_operations: UnboundedSender<Operation>,
    destroyed: CancellationToken,
    destroying: CancellationToken,
    pub state: SessionStateAPI,
    pub tracker: OperationTrackerAPI,
}

impl Session {
    /// Starts a new chipmunk session
    ///
    /// use `uuid` as the handle to refer to this session
    /// This method will spawn a new task that runs the operations loop and
    /// the state loop.
    /// The operations loop is the entry point to pass operations requests from an outside thread.
    /// The state loop is responsible for all state manipulations of the session.
    ///
    pub async fn new(
        uuid: Uuid,
    ) -> Result<(Self, UnboundedReceiver<stypes::CallbackEvent>), stypes::ComputationError> {
        let (tx_operations, rx_operations): OperationsChannel = unbounded_channel();
        let (tracker_api, rx_tracker_api) = OperationTrackerAPI::new();
        let (state_api, rx_state_api) = SessionStateAPI::new(tracker_api.clone());
        let (tx_callback_events, rx_callback_events): (
            UnboundedSender<stypes::CallbackEvent>,
            UnboundedReceiver<stypes::CallbackEvent>,
        ) = unbounded_channel();
        let session = Self {
            uuid,
            tx_operations: tx_operations.clone(),
            destroyed: CancellationToken::new(),
            destroying: CancellationToken::new(),
            state: state_api.clone(),
            tracker: tracker_api.clone(),
        };
        let destroyed = session.destroyed.clone();
        let destroying = session.destroying.clone();
        let (tx, rx) = oneshot::channel();
        let handle = task::spawn(async move {
            let self_handle: JoinHandle<()> = match rx.await {
                Ok(handle) => handle,
                Err(_) => {
                    error!("Fail to get handle of session task");
                    return;
                }
            };
            debug!("Session is started");
            let tx_callback_events_state = tx_callback_events.clone();
            join!(
                async {
                    destroying.cancelled().await;
                    if time::timeout(
                        time::Duration::from_millis(SHUTDOWN_TIMEOUT_IN_MS),
                        destroyed.cancelled(),
                    )
                    .await
                    .is_err()
                    {
                        warn!(
                            "Session isn't shutdown in {}s; forcing termination.",
                            SHUTDOWN_TIMEOUT_IN_MS / 1000
                        );
                        self_handle.abort();
                        destroyed.cancel();
                    };
                },
                async {
                    join!(
                        operations::run(
                            rx_operations,
                            state_api.clone(),
                            tracker_api.clone(),
                            tx_callback_events.clone(),
                        ),
                        Self::run(
                            &tx_operations,
                            &destroying,
                            "state",
                            state::run(rx_state_api, tx_callback_events_state)
                        ),
                        Self::run(
                            &tx_operations,
                            &destroying,
                            "tracker",
                            tracker::run(state_api.clone(), rx_tracker_api)
                        ),
                    );
                    destroyed.cancel();
                    debug!("Session is finished");
                }
            );
            debug!("Session task is finished");
        });
        if tx.send(handle).is_err() {
            Err(stypes::ComputationError::SessionCreatingFail)
        } else {
            Ok((session, rx_callback_events))
        }
    }

    /// Runs the provided future until it's finished, sending stop signal on errors.
    async fn run(
        tx_operations: &UnboundedSender<Operation>,
        destroying: &CancellationToken,
        name: &str,
        f: impl Future<Output = Result<(), stypes::NativeError>> + Send + 'static,
    ) {
        if let Err(err) = f.await {
            error!("State loop exits with error:: {err:?}");
            if let Err(err) =
                Session::send_stop_signal(Uuid::new_v4(), tx_operations, None, destroying).await
            {
                error!("Fail to send stop signal (on {name} fail):: {err:?}");
            }
        }
    }

    pub fn get_uuid(&self) -> Uuid {
        self.uuid
    }
    pub fn get_state(&self) -> SessionStateAPI {
        self.state.clone()
    }

    pub async fn grab(
        &self,
        range: LineRange,
    ) -> Result<stypes::GrabbedElementList, stypes::ComputationError> {
        self.state
            .grab(range)
            .await
            .map(|els| els.into())
            .map_err(stypes::ComputationError::NativeError)
    }

    pub async fn grab_indexed(
        &self,
        range: RangeInclusive<u64>,
    ) -> Result<stypes::GrabbedElementList, stypes::ComputationError> {
        println!("------------- DEBUG AAZ: Grab indexed requested. Range: {range:?}");
        self.state
            .grab_indexed(range)
            .await
            .map(|els| els.into())
            .map_err(stypes::ComputationError::NativeError)
    }

    pub async fn set_indexing_mode(&self, mode: u8) -> Result<(), stypes::ComputationError> {
        self.state
            .set_indexing_mode(match mode {
                0u8 => IndexesMode::Regular,
                1u8 => IndexesMode::Breadcrumbs,
                _ => return Err(stypes::ComputationError::InvalidData),
            })
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    pub async fn get_indexed_len(&self) -> Result<usize, stypes::ComputationError> {
        self.state
            .get_indexed_len()
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    pub async fn get_around_indexes(
        &self,
        position: u64,
    ) -> Result<stypes::AroundIndexes, stypes::ComputationError> {
        self.state
            .get_around_indexes(position)
            .await
            .map(|v| v.into())
            .map_err(stypes::ComputationError::NativeError)
    }

    pub async fn add_bookmark(&self, row: u64) -> Result<(), stypes::ComputationError> {
        self.state
            .add_bookmark(row)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    pub async fn set_bookmarks(&self, rows: Vec<u64>) -> Result<(), stypes::ComputationError> {
        self.state
            .set_bookmarks(rows)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    pub async fn remove_bookmark(&self, row: u64) -> Result<(), stypes::ComputationError> {
        self.state
            .remove_bookmark(row)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    pub async fn expand_breadcrumbs(
        &self,
        seporator: u64,
        offset: u64,
        above: bool,
    ) -> Result<(), stypes::ComputationError> {
        self.state
            .expand_breadcrumbs(seporator, offset, above)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    /// Calls "nested" search functionality.
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
    /// * `Err(stypes::ComputationError)` - Describes the error encountered during the process.
    pub async fn search_nested_match(
        &self,
        filter: SearchFilter,
        from: u64,
        rev: bool,
    ) -> Result<Option<(u64, u64)>, stypes::ComputationError> {
        self.state
            .search_nested_match(filter, from, rev)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    pub async fn grab_search(
        &self,
        range: LineRange,
    ) -> Result<stypes::GrabbedElementList, stypes::ComputationError> {
        self.state
            .grab_search(range)
            .await
            .map(|els| els.into())
            .map_err(stypes::ComputationError::NativeError)
    }

    pub async fn grab_ranges(
        &self,
        ranges: Vec<RangeInclusive<u64>>,
    ) -> Result<stypes::GrabbedElementList, stypes::ComputationError> {
        println!("------------- DEBUG AAZ: Grab ranges requested. Range: {ranges:?}");
        self.state
            .grab_ranges(ranges)
            .await
            .map(|els| els.into())
            .map_err(stypes::ComputationError::NativeError)
    }

    pub fn abort(&self, operation_id: Uuid, target: Uuid) -> Result<(), stypes::ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Cancel { target },
            ))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))
    }

    pub async fn send_into_sde(
        &self,
        target: Uuid,
        msg: stypes::SdeRequest,
    ) -> Result<stypes::SdeResponse, stypes::ComputationError> {
        let (tx_response, rx_response) = oneshot::channel();
        if let Some(tx_sde) = self
            .tracker
            .get_sde_sender(target)
            .await
            .map_err(|e| stypes::ComputationError::IoOperation(format!("{e:?}")))?
        {
            tx_sde.send((msg, tx_response)).map_err(|_| {
                stypes::ComputationError::Communication(String::from(
                    "Fail to send message into SDE channel",
                ))
            })?;
            rx_response
                .await
                .map_err(|_| {
                    stypes::ComputationError::Communication(String::from(
                        "Fail to get response from SDE channel",
                    ))
                })?
                .map_err(stypes::ComputationError::Sde)
        } else {
            Err(stypes::ComputationError::IoOperation(String::from(
                "No SDE channel",
            )))
        }
    }

    pub(crate) async fn send_stop_signal(
        operation_id: Uuid,
        tx_operations: &UnboundedSender<Operation>,
        destroyed: Option<&CancellationToken>,
        destroying: &CancellationToken,
    ) -> Result<(), stypes::ComputationError> {
        destroying.cancel();
        tx_operations
            .send(Operation::new(operation_id, operations::OperationKind::End))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))?;
        if let Some(destroyed) = destroyed {
            destroyed.cancelled().await;
        }
        Ok(())
    }

    pub async fn stop(&self, operation_id: Uuid) -> Result<(), stypes::ComputationError> {
        Session::send_stop_signal(
            operation_id,
            &self.tx_operations,
            Some(&self.destroyed),
            &self.destroying,
        )
        .await
    }

    pub async fn get_stream_len(&self) -> Result<usize, stypes::ComputationError> {
        self.state
            .get_stream_len()
            .await
            .map_err(stypes::ComputationError::NativeError)
            .map(|(rows, _bytes)| rows as usize)
    }

    pub async fn get_search_result_len(&self) -> Result<usize, stypes::ComputationError> {
        self.state
            .get_search_result_len()
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    pub fn observe(
        &self,
        operation_id: Uuid,
        options: stypes::ObserveOptions,
    ) -> Result<(), stypes::ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Observe(options),
            ))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))
    }

    pub async fn get_sources(&self) -> Result<stypes::Sources, stypes::ComputationError> {
        self.state
            .get_sources_definitions()
            .await
            .map(|v| v.into())
            .map_err(stypes::ComputationError::NativeError)
    }

    /// Exports data to the specified output path with the given parameters. This method is used to export
    /// only into text format. For exporting into raw format is using method `export_raw`
    ///
    /// # Arguments
    ///
    /// * `out_path` - A `PathBuf` representing the path to the output file where data will be exported.
    /// * `ranges` - A `Vec<RangeInclusive<u64>>` specifying the ranges of data to export.
    /// * `columns` - A `Vec<usize>` containing the column number to be exported.
    /// * `spliter` - A `String` used as the record separator in session file to split log message to columns.
    /// * `delimiter` - A `String` used as the field delimiter within each record in output file.
    /// * `operation_id` - A `String` representing the unique identifier for the export operation, used for tracking.
    ///
    /// # Returns
    ///
    /// * `Result<(), stypes::ComputationError>`:
    ///     - `Ok(())` if the export is successful.
    ///     - `Err(stypes::ComputationError)` if an error occurs during the export process.
    ///
    pub fn export(
        &self,
        operation_id: Uuid,
        out_path: PathBuf,
        ranges: Vec<RangeInclusive<u64>>,
        columns: Vec<usize>,
        spliter: Option<String>,
        delimiter: Option<String>,
    ) -> Result<(), stypes::ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Export {
                    out_path,
                    ranges,
                    columns,
                    spliter,
                    delimiter,
                },
            ))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))
    }

    pub fn export_raw(
        &self,
        operation_id: Uuid,
        out_path: PathBuf,
        ranges: Vec<RangeInclusive<u64>>,
    ) -> Result<(), stypes::ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::ExportRaw { out_path, ranges },
            ))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))
    }

    pub async fn is_raw_export_available(&self) -> Result<bool, stypes::ComputationError> {
        self.state
            .is_raw_export_available()
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    pub fn apply_search_filters(
        &self,
        operation_id: Uuid,
        filters: Vec<SearchFilter>,
    ) -> Result<(), stypes::ComputationError> {
        println!("------------- DEBUG AAZ: Apply search filter requested. Range: {filters:?}");
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Search { filters },
            ))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))
    }

    pub fn apply_search_values_filters(
        &self,
        operation_id: Uuid,
        filters: Vec<String>,
    ) -> Result<(), stypes::ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::SearchValues { filters },
            ))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))
    }

    pub async fn drop_search(&self) -> Result<bool, stypes::ComputationError> {
        println!("------------- DEBUG AAZ: Drop search requested");
        self.state
            .drop_search()
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    pub fn extract_matches(
        &self,
        operation_id: Uuid,
        filters: Vec<SearchFilter>,
    ) -> Result<(), stypes::ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Extract { filters },
            ))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))
    }

    pub fn get_map(
        &self,
        operation_id: Uuid,
        dataset_len: u16,
        range: Option<(u64, u64)>,
    ) -> Result<(), stypes::ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Map { dataset_len, range },
            ))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))
    }

    pub fn get_values(
        &self,
        operation_id: Uuid,
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
    ) -> Result<(), stypes::ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Values { dataset_len, range },
            ))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))
    }

    pub fn get_nearest_to(
        &self,
        operation_id: Uuid,
        position_in_stream: u64,
    ) -> Result<(), stypes::ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::GetNearestPosition(position_in_stream),
            ))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))
    }

    pub async fn get_attachments(
        &self,
    ) -> Result<stypes::AttachmentList, stypes::ComputationError> {
        self.state
            .get_attachments()
            .await
            .map(|v| v.into())
            .map_err(stypes::ComputationError::NativeError)
    }

    pub async fn get_indexed_ranges(&self) -> Result<stypes::Ranges, stypes::ComputationError> {
        self.state
            .get_indexed_ranges()
            .await
            .map(|v| v.into())
            .map_err(stypes::ComputationError::NativeError)
    }

    /// Used for debug goals
    pub fn sleep(
        &self,
        operation_id: Uuid,
        ms: u64,
        ignore_cancellation: bool,
    ) -> Result<(), stypes::ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Sleep(ms, ignore_cancellation),
            ))
            .map_err(|e| stypes::ComputationError::Communication(e.to_string()))
    }

    /// Used for debug goals
    pub async fn trigger_state_error(&self) -> Result<(), stypes::ComputationError> {
        self.state
            .shutdown_with_error()
            .map_err(stypes::ComputationError::NativeError)
    }

    /// Used for debug goals
    pub async fn trigger_tracker_error(&self) -> Result<(), stypes::ComputationError> {
        self.tracker
            .shutdown_with_error()
            .map_err(stypes::ComputationError::NativeError)
    }
}
