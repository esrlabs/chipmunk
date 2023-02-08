use crate::{
    events::{CallbackEvent, ComputationError},
    operations,
    operations::Operation,
    state,
    state::{GrabbedElement, IndexesMode, SessionStateAPI, SourceDefinition},
    tracker,
    tracker::OperationTrackerAPI,
};
use indexer_base::progress::Severity;
use log::{debug, error};
use processor::{grabber::LineRange, search::filter::SearchFilter};
use serde::Serialize;
use sources::factory::ObserveOptions;
use std::{ops::RangeInclusive, path::PathBuf};
use tokio::{
    join,
    sync::{
        mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot,
    },
    task,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub type OperationsChannel = (UnboundedSender<Operation>, UnboundedReceiver<Operation>);

pub struct Session {
    uuid: Uuid,
    tx_operations: UnboundedSender<Operation>,
    destroyed: CancellationToken,
    pub state: SessionStateAPI,
    pub tracker: OperationTrackerAPI,
}

impl Session {
    /// Starts a new chipmunk session
    ///
    /// use `uuid` as the handle to refer to this session
    /// This method will spawn a new task that runs the operations loop and
    /// the state loop.
    /// The operations loop is the entry point to pass opartion requests from an outside thread.
    /// The state loop is responsible for all state manipulations of the session.
    ///
    pub async fn new(uuid: Uuid) -> (Self, UnboundedReceiver<CallbackEvent>) {
        let (tx_operations, rx_operations): OperationsChannel = unbounded_channel();
        let (tracker_api, rx_tracker_api) = OperationTrackerAPI::new();
        let (state_api, rx_state_api) = SessionStateAPI::new(tracker_api.clone());
        let (tx_callback_events, rx_callback_events): (
            UnboundedSender<CallbackEvent>,
            UnboundedReceiver<CallbackEvent>,
        ) = unbounded_channel();
        let session = Self {
            uuid,
            tx_operations,
            destroyed: CancellationToken::new(),
            state: state_api.clone(),
            tracker: tracker_api.clone(),
        };
        let destroyed = session.destroyed.clone();
        task::spawn(async move {
            debug!("Session is started");
            let tx_callback_events_state = tx_callback_events.clone();
            let (_, _, _) = join!(
                async {
                    let result = operations::run(
                        rx_operations,
                        state_api.clone(),
                        tracker_api.clone(),
                        tx_callback_events.clone(),
                    )
                    .await;
                    if let Err(err) = state_api.shutdown() {
                        error!("Fail to shutdown state; error: {:?}", err);
                    }
                    result
                },
                state::run(rx_state_api, tx_callback_events_state),
                tracker::run(state_api.clone(), rx_tracker_api),
            );
            destroyed.cancel();
            debug!("Session is finished");
        });
        (session, rx_callback_events)
    }

    pub fn get_uuid(&self) -> Uuid {
        self.uuid
    }
    pub fn get_state(&self) -> SessionStateAPI {
        self.state.clone()
    }

    pub async fn grab(&self, range: LineRange) -> Result<Vec<GrabbedElement>, ComputationError> {
        self.state
            .grab(range)
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn grab_indexed(
        &self,
        range: RangeInclusive<u64>,
    ) -> Result<Vec<GrabbedElement>, ComputationError> {
        self.state
            .grab_indexed(range)
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn set_indexing_mode(&self, mode: u8) -> Result<(), ComputationError> {
        self.state
            .set_indexing_mode(match mode {
                0u8 => IndexesMode::Regular,
                1u8 => IndexesMode::Breadcrumbs,
                _ => return Err(ComputationError::InvalidData),
            })
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn get_indexed_len(&self) -> Result<usize, ComputationError> {
        self.state
            .get_indexed_len()
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn get_around_indexes(
        &self,
        position: u64,
    ) -> Result<(Option<u64>, Option<u64>), ComputationError> {
        self.state
            .get_around_indexes(position)
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn add_bookmark(&self, row: u64) -> Result<(), ComputationError> {
        self.state
            .add_bookmark(row)
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn set_bookmarks(&self, rows: Vec<u64>) -> Result<(), ComputationError> {
        self.state
            .set_bookmarks(rows)
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn remove_bookmark(&self, row: u64) -> Result<(), ComputationError> {
        self.state
            .remove_bookmark(row)
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn expand_breadcrumbs(
        &self,
        seporator: u64,
        offset: u64,
        above: bool,
    ) -> Result<(), ComputationError> {
        self.state
            .expand_breadcrumbs(seporator, offset, above)
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn grab_search(
        &self,
        range: LineRange,
    ) -> Result<Vec<GrabbedElement>, ComputationError> {
        self.state
            .grab_search(range)
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn grab_ranges(
        &self,
        ranges: Vec<RangeInclusive<u64>>,
    ) -> Result<Vec<GrabbedElement>, ComputationError> {
        self.state
            .grab_ranges(ranges)
            .await
            .map_err(ComputationError::NativeError)
    }

    pub fn abort(&self, operation_id: Uuid, target: Uuid) -> Result<(), ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Cancel { target },
            ))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub async fn send_into_sde(
        &self,
        target: Uuid,
        msg: String,
    ) -> Result<String, ComputationError> {
        let (tx_response, rx_response) = oneshot::channel();
        let response = if let Some(tx_sde) = self
            .tracker
            .get_sde_sender(target)
            .await
            .map_err(|e| ComputationError::IoOperation(format!("{e:?}")))?
        {
            tx_sde.send((msg, tx_response)).map_err(|_| {
                ComputationError::Communication(String::from(
                    "Fail to send message into SDE channel",
                ))
            })?;
            rx_response.await.map_err(|_| {
                ComputationError::Communication(String::from(
                    "Fail to get response from SDE channel",
                ))
            })?
        } else {
            Err(String::from("No SDE channel"))
        };
        serde_json::to_string(&response).map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub async fn stop(&self, operation_id: Uuid) -> Result<(), ComputationError> {
        self.tx_operations
            .send(Operation::new(operation_id, operations::OperationKind::End))
            .map_err(|e| ComputationError::Communication(e.to_string()))?;
        self.destroyed.cancelled().await;
        Ok(())
    }

    pub async fn get_stream_len(&self) -> Result<usize, ComputationError> {
        self.state
            .get_stream_len()
            .await
            .map_err(ComputationError::NativeError)
            .map(|(rows, _bytes)| rows as usize)
    }

    pub async fn get_search_result_len(&self) -> Result<usize, ComputationError> {
        self.state
            .get_search_result_len()
            .await
            .map_err(ComputationError::NativeError)
    }

    pub fn observe(
        &self,
        operation_id: Uuid,
        options: ObserveOptions,
    ) -> Result<(), ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Observe(options),
            ))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub async fn get_sources(&self) -> Result<Vec<SourceDefinition>, ComputationError> {
        self.state
            .get_sources_definitions()
            .await
            .map_err(ComputationError::NativeError)
    }

    pub fn export(
        &self,
        operation_id: Uuid,
        out_path: PathBuf,
        ranges: Vec<RangeInclusive<u64>>,
    ) -> Result<(), ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Export { out_path, ranges },
            ))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub fn export_raw(
        &self,
        operation_id: Uuid,
        out_path: PathBuf,
        ranges: Vec<RangeInclusive<u64>>,
    ) -> Result<(), ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::ExportRaw { out_path, ranges },
            ))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub async fn is_raw_export_available(&self) -> Result<bool, ComputationError> {
        self.state
            .is_raw_export_available()
            .await
            .map_err(ComputationError::NativeError)
    }

    pub fn apply_search_filters(
        &self,
        operation_id: Uuid,
        filters: Vec<SearchFilter>,
    ) -> Result<(), ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Search { filters },
            ))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub async fn drop_search(&self) -> Result<bool, ComputationError> {
        self.state
            .drop_search()
            .await
            .map_err(ComputationError::NativeError)
    }

    pub fn extract_matches(
        &self,
        operation_id: Uuid,
        filters: Vec<SearchFilter>,
    ) -> Result<(), ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Extract { filters },
            ))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub fn get_map(
        &self,
        operation_id: Uuid,
        dataset_len: u16,
        range: Option<(u64, u64)>,
    ) -> Result<(), ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Map { dataset_len, range },
            ))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub fn get_nearest_to(
        &self,
        operation_id: Uuid,
        position_in_stream: u64,
    ) -> Result<(), ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::GetNearestPosition(position_in_stream),
            ))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    /// Used for debug goals
    pub fn sleep(&self, operation_id: Uuid, ms: u64) -> Result<(), ComputationError> {
        self.tx_operations
            .send(Operation::new(
                operation_id,
                operations::OperationKind::Sleep(ms),
            ))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct GeneralError {
    severity: Severity,
    message: String,
}
