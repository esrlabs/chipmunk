/// Messages from the MCP client to chipmunk
#[derive(Debug)]
pub enum McpClientToChipmunk {
    Response { response: String },
}

/// Messages chipmunk to the MCP client
#[derive(Debug, Clone)]
pub enum McpChipmunkToClient {
    Prompt { prompt: String },
}
