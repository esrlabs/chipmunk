use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, JsonSchema, Serialize, Deserialize)]
pub struct ChartFilter {
    pub value: String,
    pub is_regex: bool,
    pub ignore_case: bool,
    pub is_word: bool,
}

#[derive(Clone, Debug, Default, JsonSchema, Serialize, Deserialize)]
pub struct SearchFilter {
    pub value: String,
    pub is_regex: bool,
    pub ignore_case: bool,
    pub is_word: bool,
}

#[derive(Debug, Default, JsonSchema, Serialize, Deserialize)]
pub struct SearchFilterParameter {
    pub filters: Vec<SearchFilter>,
}

#[derive(Debug, Default, JsonSchema, Serialize, Deserialize)]
pub struct ChartFilterParameter {
    pub filters: Vec<ChartFilter>,
}
