use tokio::sync::oneshot;

use crate::types::McpError;

/// Messages from the MCP server to chipmunk
#[derive(Debug)]
pub enum McpServerToChipmunk {
    ApplyFilter {
        filters: Vec<SearchFilter>,
        response_tx: oneshot::Sender<Result<(), McpError>>,
    },
}

// TODO: MOCK
#[derive(Debug)]
pub struct SearchFilter {
    pub value: String,
    pub is_regex: bool,
    pub ignore_case: bool,
    pub is_word: bool,
}
