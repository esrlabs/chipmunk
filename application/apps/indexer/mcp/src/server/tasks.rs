use std::ops::RangeInclusive;

use tokio::sync::mpsc;
use uuid::Uuid;

use crate::{errors::McpError, tool_params::AnalyzeAction, types::TaskResult};
use processor::search::filter::SearchFilter;

#[derive(Debug, Clone)]
pub enum Tasks {
    ApplySearchFilter {
        session_id: Uuid,
        filters: Vec<SearchFilter>,
        task_result_tx: mpsc::Sender<Result<TaskResult, McpError>>,
    },
    GetChartHistogram {
        session_id: Uuid,
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
        task_result_tx: mpsc::Sender<Result<TaskResult, McpError>>,
    },
    GetChartLinePlots {
        session_id: Uuid,
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
        task_result_tx: mpsc::Sender<Result<TaskResult, McpError>>,
    },
    GenericTask {
        session_id: Uuid,
        task_result_tx: mpsc::Sender<Result<TaskResult, McpError>>,
    },
    AnalyzeLogFile {
        session_id: Uuid,
        range: Option<RangeInclusive<u64>>,
        action: AnalyzeAction,
        filters: Vec<SearchFilter>,
        jump_to_line: Option<u64>,
        note: Option<String>,
        task_result_tx: mpsc::Sender<Result<TaskResult, McpError>>,
    },
    GrabLines {
        session_id: Uuid,
        range: RangeInclusive<u64>,
        task_result_tx: mpsc::Sender<Result<TaskResult, McpError>>,
    },
    CompleteChat {
        session_id: Uuid,
        final_result: String,
        task_result_tx: mpsc::Sender<Result<TaskResult, McpError>>,
    },
}
