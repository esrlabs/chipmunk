use std::ops::RangeInclusive;

use rmcp::schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::tool_params::AnalyzeLogsResult;

pub type Response = String;

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct RangeU64 {
    pub start: u64,
    pub end: u64,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct ExportRequest {
    pub out_path: String,
    pub ranges: Vec<RangeU64>,
    pub columns: Vec<usize>,
    pub spliter: Option<String>,
    pub delimiter: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TaskResult {
    Complete(String),
    RequestLines(RangeInclusive<u64>),
    AnalyzeLogs(AnalyzeLogsResult),
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct ExportRawRequest {
    pub out_path: String,
    pub ranges: Vec<RangeU64>,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct CancelRequest {
    pub target: String,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct NearestPositionRequest {
    pub position_in_stream: u64,
}
