use crate::{
    events::{CallbackEvent, ComputationError},
    operations,
    operations::Operation,
    state,
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use log::{debug, error};
use processor::{
    grabber::{GrabbedContent, LineRange},
    search::SearchFilter,
};
use serde::Serialize;
use std::path::PathBuf;
use tokio::{
    join,
    sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    task,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub type OperationsChannel = (
    UnboundedSender<(Uuid, Operation)>,
    UnboundedReceiver<(Uuid, Operation)>,
);

pub struct Session {
    uuid: Uuid,
    tx_operations: UnboundedSender<(Uuid, Operation)>,
    destroyed: CancellationToken,
    pub state: SessionStateAPI,
}

impl Session {
    pub async fn new(uuid: Uuid) -> (Self, UnboundedReceiver<CallbackEvent>) {
        let (tx_operations, rx_operations): OperationsChannel = unbounded_channel();
        let (state_api, rx_state_api) = SessionStateAPI::new();
        let (tx_callback_events, rx_callback_events): (
            UnboundedSender<CallbackEvent>,
            UnboundedReceiver<CallbackEvent>,
        ) = unbounded_channel();
        let session = Self {
            uuid,
            tx_operations,
            destroyed: CancellationToken::new(),
            state: state_api.clone(),
        };
        let destroyed = session.destroyed.clone();
        task::spawn(async move {
            debug!("Session is started");
            let tx_callback_events_state = tx_callback_events.clone();
            let (_, _) = join!(
                async {
                    let result = operations::task(
                        rx_operations,
                        state_api.clone(),
                        tx_callback_events.clone(),
                    )
                    .await;
                    if let Err(err) = state_api.shutdown() {
                        error!("Fail to shutdown state; error: {:?}", err);
                    }
                    result
                },
                state::task(rx_state_api, tx_callback_events_state),
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

    pub async fn grab(&self, range: LineRange) -> Result<GrabbedContent, ComputationError> {
        self.state
            .grab(range)
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn grab_search(&self, range: LineRange) -> Result<GrabbedContent, ComputationError> {
        self.state
            .grab_search(range)
            .await
            .map_err(ComputationError::NativeError)
    }

    pub fn abort(&self, operation_id: Uuid, target: Uuid) -> Result<(), ComputationError> {
        self.tx_operations
            .send((operation_id, operations::Operation::Cancel { target }))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub async fn stop(&self, operation_id: Uuid) -> Result<(), ComputationError> {
        self.tx_operations
            .send((operation_id, operations::Operation::End))
            .map_err(|e| ComputationError::Communication(e.to_string()))?;
        self.destroyed.cancelled().await;
        Ok(())
    }

    pub async fn get_stream_len(&self) -> Result<usize, ComputationError> {
        self.state
            .get_stream_len()
            .await
            .map_err(ComputationError::NativeError)
    }

    pub async fn get_search_result_len(&self) -> Result<usize, ComputationError> {
        self.state
            .get_search_result_len()
            .await
            .map_err(ComputationError::NativeError)
    }

    pub fn observe(&self, operation_id: Uuid, file_path: PathBuf) -> Result<(), ComputationError> {
        self.tx_operations
            .send((operation_id, operations::Operation::Observe { file_path }))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub fn apply_search_filters(
        &self,
        operation_id: Uuid,
        filters: Vec<SearchFilter>,
    ) -> Result<(), ComputationError> {
        self.tx_operations
            .send((operation_id, operations::Operation::Search { filters }))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub fn extract_matches(
        &self,
        operation_id: Uuid,
        filters: Vec<SearchFilter>,
    ) -> Result<(), ComputationError> {
        self.tx_operations
            .send((operation_id, operations::Operation::Extract { filters }))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub fn get_map(
        &self,
        operation_id: Uuid,
        dataset_len: u16,
        range: Option<(u64, u64)>,
    ) -> Result<(), ComputationError> {
        self.tx_operations
            .send((
                operation_id,
                operations::Operation::Map { dataset_len, range },
            ))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    pub fn get_nearest_to(
        &self,
        operation_id: Uuid,
        position_in_stream: u64,
    ) -> Result<(), ComputationError> {
        self.tx_operations
            .send((
                operation_id,
                operations::Operation::GetNearestPosition(position_in_stream),
            ))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }

    /// Used for debug goals
    pub fn sleep(&self, operation_id: Uuid, ms: u64) -> Result<(), ComputationError> {
        self.tx_operations
            .send((operation_id, operations::Operation::Sleep(ms)))
            .map_err(|e| ComputationError::Communication(e.to_string()))
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GeneralError {
    severity: Severity,
    message: String,
}
