use std::{ffi::os_str::Display, fmt};

use rmcp::ServiceError;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum McpError {
    // Client errors
    #[error("MCP service error: {0}")]
    Service(#[from] ServiceError),

    #[error("Connection failed: {message}")]
    Connection { message: String },

    #[error("Request timeout: {message}")]
    Timeout { message: String },

    // Server errors
    #[error("Tool execution failed: {message}")]
    ToolExecution { message: String },

    #[error("Setup failed: {message}")]
    Setup { message: String },

    // Generic
    #[error("{message}")]
    Generic { message: String },
}

// TODO:[MCP] Probably makes sense to move to tools.rs if we will, have that (in the server?)
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
