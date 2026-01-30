use std::fmt;

use rmcp::schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub type Prompt = String;
pub type Response = String;

#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct SearchFilter {
    pub value: String,
    pub is_regex: bool,
    pub ignore_case: bool,
    pub is_word: bool,
}

// TODO:[MCP] Probably makes sense to move to tools.rs if we will, have that (in the server?)
#[derive(Clone, Debug, JsonSchema, Serialize, Deserialize)]
pub struct SearchFilters {
    pub filters: Vec<SearchFilter>,
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
