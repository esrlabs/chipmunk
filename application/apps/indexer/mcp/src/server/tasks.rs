use tokio::sync::oneshot;

use crate::errors::McpError;
use crate::types::SearchFilter;

pub enum Tasks {
    ApplySearchFilter {
        filters: Vec<SearchFilter>,
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },

    DropSearch {
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },
    SearchValues {
        filters: Vec<String>,
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },
    ExtractMatches {
        filters: Vec<SearchFilter>,
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },
    GetChartHistogram {
        dataset_len: u16,
        range: Option<(u64, u64)>,
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },
    GetChartLinePlots {
        dataset_len: u16,
        range: Option<(u64, u64)>,
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },
    Export {
        out_path: String,
        ranges: Vec<(u64, u64)>,
        columns: Vec<usize>,
        spliter: Option<String>,
        delimiter: Option<String>,
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },
    ExportRaw {
        out_path: String,
        ranges: Vec<(u64, u64)>,
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },
    CancelOperation {
        target: String,
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },
    GetNearestPosition {
        position_in_stream: u64,
        task_result_tx: oneshot::Sender<Result<(), McpError>>,
    },
}
