use anyhow::Result;
use log::{error, warn};
use rmcp::{
    ErrorData as RmcpError,
    handler::server::wrapper::Parameters,
    handler::server::{ServerHandler, tool::ToolRouter},
    model::{CallToolResult, Content, ErrorCode},
    model::{ServerCapabilities, ServerInfo},
    tool, tool_handler, tool_router,
    transport::streamable_http_server::{
        session::local::LocalSessionManager,
        tower::{StreamableHttpServerConfig, StreamableHttpService},
    },
};
use tokio::{
    sync::{mpsc, oneshot},
    time::{self, sleep},
};

pub mod messages;

pub const BIND_ADDRESS: &str = "127.0.0.1:8181";

use messages::McpServerToChipmunk;

use crate::server::messages::SearchFilter;

#[derive(Clone, Debug)]
pub struct McpServer {
    server_to_chipmunk_tx: mpsc::Sender<McpServerToChipmunk>,
    pub tool_router: ToolRouter<Self>,
}

#[tool_handler]
impl ServerHandler for McpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some("Chipmunk MCP Server".to_string()),
            capabilities: ServerCapabilities::builder()
                .enable_tools()
                .enable_resources()
                .enable_prompts()
                .build(),
            ..Default::default()
        }
    }
}

#[tool_router]
impl McpServer {
    pub fn new() -> (Self, mpsc::Receiver<McpServerToChipmunk>) {
        let (server_to_chipmunk_tx, server_to_chipmunk_rx) = mpsc::channel(32);

        (
            Self {
                server_to_chipmunk_tx,
                tool_router: Self::tool_router(),
            },
            server_to_chipmunk_rx,
        )
    }

    pub async fn start(self) -> Result<()> {
        let ct = tokio_util::sync::CancellationToken::new();
        let (mcp_server, _task_rx_inner) = McpServer::new();

        let service = StreamableHttpService::new(
            move || Ok(mcp_server.clone()),
            LocalSessionManager::default().into(),
            StreamableHttpServerConfig {
                cancellation_token: ct.child_token(),
                ..Default::default()
            },
        );
        let router = axum::Router::new().nest_service("/mcp", service);
        let tcp_listener = tokio::net::TcpListener::bind(BIND_ADDRESS).await?;

        tokio::spawn(async move {
            if let Err(server_err) = axum::serve(tcp_listener, router).await {
                eprintln!("MCP Server error: {:?}", server_err);
            }
        });

        Ok(())
    }

    #[allow(dead_code)]
    async fn run(self) {
        // TODO: Send a mock message after 1 seconds
        warn!("🔅 MCP: sleep timer started");
        let duration = time::Duration::from_secs(10);
        sleep(duration).await;
        warn!("🔅 MCP: {:?} seconds passed", duration);

        let (response_tx, response_rx) = oneshot::channel();

        let filters = vec![SearchFilter {
            value: String::from("icmp_seq=13"),
            is_regex: false,
            ignore_case: true,
            is_word: true,
        }];

        let message = McpServerToChipmunk::ApplyFilter {
            filters,
            response_tx,
        };

        if let Err(err) = self.server_to_chipmunk_tx.send(message).await {
            error!(
                "[Chipmunk] <-X- [MCP server]: server failed to send request: ApplyFilter: {err}"
            );
            return;
        }

        match response_rx.await {
            Err(err) => {
                error!(
                    "[Chipmunk] -X-> [MCP server]: server failed to receive response: ApplyFilter: {err}"
                );
            }
            Ok(result) => {
                error!(
                    "[Chipmunk] --> [MCP server]: ✅ Received response: {:?}",
                    result
                )
            }
        }
    }

    #[tool(description = r#"Generate SearchFilter objects for filtering logs.

This tool accepts one or more filter specifications and returns a list of SearchFilter objects.
Each filter can be customized with flags for regex matching, case sensitivity, and word boundaries.

**Input Parameters:**
- `filters`: An array of filter objects, where each object contains:
  - `filter` (string): The text or pattern to search for
  - `is_regex` (boolean): true if the filter is a regular expression pattern
  - `ignore_case` (boolean): true for case-insensitive matching
  - `is_word` (boolean): true to match whole words only (word boundary matching)

**Usage Examples:**

Single filter:
- Input: [{"filter": "error", "is_regex": false, "ignore_case": false, "is_word": false}]
- Use case: Find exact matches of "error"

Multiple filters:
- Input: [
    {"filter": "ERROR", "is_regex": false, "ignore_case": true, "is_word": false},
    {"filter": "\\d{4}-\\d{2}-\\d{2}", "is_regex": true, "ignore_case": false, "is_word": false}
  ]
- Use case: Find "ERROR" (any case) OR date patterns

Common patterns:
- Case-insensitive word: {"filter": "warning", "is_regex": false, "ignore_case": true, "is_word": true}
- Regex pattern: {"filter": "\\b(error|fail|exception)\\b", "is_regex": true, "ignore_case": false, "is_word": false}
- Exact match: {"filter": "timeout", "is_regex": false, "ignore_case": false, "is_word": false}

**Natural Language Interpretation:**
When the user provides natural language instructions, interpret them as follows:
- "error" → single filter for "error"
- "error or warning" → two filters, one for "error" and one for "warning"
- "case-insensitive ERROR" → set ignore_case: true
- "match the word 'timeout'" → set is_word: true
- "regex pattern \\d+" → set is_regex: true
- "find ERROR, WARNING, and CRITICAL" → three separate filters
"#)]
    async fn apply_search_filter(
        &self,
        Parameters(params): Parameters<Vec<SearchFilter>>,
    ) -> Result<CallToolResult, RmcpError> {
        log::info!(
            "Received apply_search_filter tool call with params: {:?}",
            params
        );
        let (response_tx, response_rx) = tokio::sync::oneshot::channel();
        let task = McpServerToChipmunk::ApplyFilter {
            filters: vec![],
            response_tx,
        };
        let task_tx_clone = self.server_to_chipmunk_tx.clone();
        // Send task over communication channel in a separate thread,
        // in future, we can skip match over task spawn
        match tokio::spawn(async move { task_tx_clone.send(task).await }).await {
            Ok(_) => log::info!("Sent Search task to MCP server"),
            Err(err) => log::error!(
                "Failed to send Search task to MCP server: ApplyFilter: {}",
                err
            ),
        };

        // Wait for the response from task over communication channel
        // based on the response send back the JSON response to client
        response_rx
            .await
            .map(|task_response| match task_response {
                Ok(()) => Ok(CallToolResult::success(vec![Content::json(
                    "Server task finished successfully",
                )?])),
                Err(err) => {
                    let err_msg = format!("Error while applying the task: {err}");
                    Ok(CallToolResult::error(vec![Content::json(err_msg)?]))
                }
            })
            .map_err(|err| {
                RmcpError::new(
                    ErrorCode::INTERNAL_ERROR,
                    format!("Did not receive the response from search filter task {err:?}"),
                    None,
                )
            })?
    }
}
