use std::ops::RangeInclusive;

use tokio::sync::mpsc;
use uuid::Uuid;

use crate::errors::McpError;
use processor::search::filter::SearchFilter;

#[derive(Debug, Clone)]
pub enum Tasks {
    ApplySearchFilter {
        session_id: Uuid,
        filters: Vec<SearchFilter>,
        task_result_tx: mpsc::Sender<Result<String, McpError>>,
    },
    GetChartHistogram {
        session_id: Uuid,
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
        task_result_tx: mpsc::Sender<Result<String, McpError>>,
    },
    GetChartLinePlots {
        session_id: Uuid,
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
        task_result_tx: mpsc::Sender<Result<String, McpError>>,
    },
    GenericTask {
        session_id: Uuid,
        task_result_tx: mpsc::Sender<Result<String, McpError>>,
    },
}
