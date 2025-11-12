use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, JsonSchema, Serialize, Deserialize)]
pub struct SearchFilter {
    pub value: String,
    pub is_regex: bool,
    pub ignore_case: bool,
    pub is_word: bool,
}

#[derive(Debug, Default, JsonSchema, Serialize, Deserialize)]
pub struct FilterParameter {
    pub filters: Vec<SearchFilter>,
}
