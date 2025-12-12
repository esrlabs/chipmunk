use tokio::sync::oneshot;

use crate::types::McpError;

use crate::types::SearchFilter;

/// Messages from the MCP server to chipmunk
#[derive(Debug)]
pub enum McpServerToChipmunk {
    ApplySearchFilter {
        filters: Vec<SearchFilter>,
        response_tx: oneshot::Sender<Result<(), McpError>>,
    },
}
