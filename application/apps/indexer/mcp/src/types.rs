use std::fmt;

use rmcp::schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub type Prompt = String;
pub type Response = String;

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
pub struct RangeU64 {
    pub start: u64,
    pub end: u64,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct SearchFilters {
    pub filters: Vec<SearchFilter>,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct SearchValuesFilters {
    pub filters: Vec<String>,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct MapRequest {
    pub dataset_len: u16,
    pub range: Option<RangeU64>,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct ValuesRequest {
    pub dataset_len: u16,
    pub range: Option<RangeU64>,
}

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct ExportRequest {
    pub out_path: String,
    pub ranges: Vec<RangeU64>,
    pub columns: Vec<usize>,
    pub spliter: Option<String>,
    pub delimiter: Option<String>,
}

#[derive(Default, Clone, Debug, Serialize, Deserialize)]
pub enum LlmProvider {
    Ollama,
    #[default]
    OpenAI,
    Antropic,
    Gemini,
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
