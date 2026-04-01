use std::{fmt, ops::RangeInclusive};

use rmcp::schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct SearchFilter {
    pub value: String,
    #[serde(default)]
    pub is_regex: bool,
    #[serde(default)]
    pub ignore_case: bool,
    #[serde(default)]
    pub is_word: bool,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct SearchFilters {
    pub filters: Vec<SearchFilter>,
    pub session_id: String,
}

impl fmt::Display for SearchFilters {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let filters: Vec<String> = self
            .filters
            .iter()
            .map(|filter| {
                format!(
                    "{{ value: {}, is_regex: {}, ignore_case: {}, is_word: {} }}",
                    filter.value, filter.is_regex, filter.ignore_case, filter.is_word
                )
            })
            .collect();
        write!(f, "[{}]", filters.join(", "))
    }
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalyzeAction {
    None,
    ApplyFilter,
    JumpToLine,
}

impl Default for AnalyzeAction {
    fn default() -> Self {
        Self::None
    }
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct AnalyzeLogsRequest {
    pub session_id: String,
    #[serde(default)]
    pub range: Option<RangeInclusive<u64>>,
    #[serde(default)]
    pub action: AnalyzeAction,
    #[serde(default)]
    pub filters: Vec<SearchFilter>,
    #[serde(default)]
    pub jump_to_line: Option<u64>,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct LogLine {
    pub source_id: u16,
    pub pos: u64,
    pub nature: u8,
    pub content: String,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct AnalyzeLogsResult {
    pub requested_range: Option<RangeInclusive<u64>>,
    pub lines: Vec<LogLine>,
    pub action_status: Option<String>,
    pub note: Option<String>,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct MapRequest {
    pub dataset_len: u16,
    pub range: Option<RangeInclusive<u64>>,
    pub session_id: String,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct ValuesRequest {
    pub dataset_len: u16,
    pub range: Option<RangeInclusive<u64>>,
    pub session_id: String,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct GrabLineParams {
    pub session_id: String,
    pub range: RangeInclusive<u64>,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct ChatResult {
    pub session_id: String,
    pub result: String,
    pub success: bool,
}
