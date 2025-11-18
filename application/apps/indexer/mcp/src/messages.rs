use tokio::sync::oneshot;

/// Requests from MCP Server to rust core
#[derive(Debug)]
pub enum McpServerRequest {
    ApplyFilter {
        filters: Vec<SearchFilter>,
        // TODO: Error
        response_tx: oneshot::Sender<Result<(), ()>>,
        // Or maybe betetr with new type
        // response_tx: oneshot::Sender<ApplyFilterResult>,
    },
}

// TODO: Mock
#[derive(Debug)]
pub struct SearchFilter(String);

/// Requests from rust core to MCP Client
#[derive(Debug)]
pub enum McpClientRequest {
    SendPrompt {
        prompt: String,
        response_tx: oneshot::Sender<SendPromptResult>,
    },
}

#[derive(Debug)]
// TODO: Error
pub struct SendPromptResult(Result<String, ()>);
