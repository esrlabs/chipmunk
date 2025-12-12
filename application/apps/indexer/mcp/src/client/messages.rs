/// Messages from the MCP client to chipmunk
#[derive(Debug)]
pub enum McpClientToChipmunk {
    Response { response: String },
    // TODO:[MCP] add other message types as needed. E.g.:
}

/// Messages from chipmunk to the MCP client
#[derive(Debug, Clone)]
pub enum McpChipmunkToClient {
    UserPrompt { prompt: String },
    // TODO:[MCP] add other message types as needed. E.g.:
    // SystemPrompt { prompt: String },
}
