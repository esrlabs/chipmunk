use tokio::sync::oneshot;

use crate::errors::McpError;
use crate::types::SearchFilter;

pub enum Tasks {
    ApplySearchFilter {
        filters: Vec<SearchFilter>,
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },
    CreateCharts {
        sequence: String,
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },
}
