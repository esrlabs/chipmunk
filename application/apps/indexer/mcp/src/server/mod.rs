pub mod tasks;

pub const BIND_ADDRESS: &str = "127.0.0.1:8181";

use std::ops::RangeInclusive;

use anyhow::Result;
use rmcp::{
    ErrorData as RmcpError,
    handler::server::{ServerHandler, tool::ToolRouter, wrapper::Parameters},
    model::{CallToolResult, Content, ErrorCode, ServerCapabilities, ServerInfo},
    tool, tool_handler, tool_router,
    transport::streamable_http_server::{
        session::local::LocalSessionManager,
        tower::{StreamableHttpServerConfig, StreamableHttpService},
    },
};
use tokio::sync::{broadcast, mpsc};

use crate::errors::McpError;
use crate::types::*;
use tasks::{Tasks, Tasks::*};

#[derive(Clone, Debug)]
pub struct McpServer {
    task_tx: broadcast::Sender<Tasks>,
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
    pub fn new(task_tx: broadcast::Sender<Tasks>) -> Self {
        Self {
            task_tx,
            tool_router: Self::tool_router(),
        }
    }

    pub async fn start(self) -> Result<()> {
        let ct = tokio_util::sync::CancellationToken::new();

        let service = StreamableHttpService::new(
            {
                let server = self.clone();
                move || Ok(server.clone())
            },
            LocalSessionManager::default().into(),
            StreamableHttpServerConfig {
                cancellation_token: ct.child_token(),
                ..Default::default()
            },
        );

        let router = axum::Router::new().nest_service("/mcp", service);
        let tcp_listener = tokio::net::TcpListener::bind(BIND_ADDRESS).await?;

        tokio::spawn(async move {
            if let Err(err) = axum::serve(tcp_listener, router).await {
                println!("🔴 MCP server error: {:?}", err);
            }
        });
        println!("🟢 MCP server started");

        Ok(())
    }

    #[tool(description = r#"Generate SearchFilter objects for filtering logs.

This tool accepts one or more filter specifications along with session_id and returns a list of SearchFilter objects.
Each filter can be customized with flags for regex matching, case sensitivity, and word boundaries.
Session id is present in the prompt and can be used by the LLM Model and sent back in the parameters.
This will help the MCP server to identify which session has requested for the filter and apply it to the correct session.


**Input Parameters:**
- `filters`: An list of filter objects, where each object contains:
  - `value` (string): The text or pattern to search for
  - `is_regex` (boolean): true if the filter is a regular expression pattern
  - `ignore_case` (boolean): true for case-insensitive matching, mostly it is false.
  - `is_word` (boolean): true to match whole words only (word boundary matching)
- `session_id` (string): Unique identifier for the session requesting the filter, used to apply the filter to the correct session. Present in Chat message.

**Usage Examples:**

Single filter:
- Input: [{"value": "error", "is_regex": true, "ignore_case": false, "is_word": false}]
- Use case: Find exact matches of "error"

- Input: [{"value": "time=13", "is_regex": true, "ignore_case": false, "is_word": false}]
- Use case: Find lines in log where time is around 13


Multiple filters:
- Input: [
    {"value": "ERROR", "is_regex": true, "ignore_case": true, "is_word": false},
    {"value": "\\d{4}-\\d{2}-\\d{2}", "is_regex": true, "ignore_case": false, "is_word": false}
  ]
- Use case: Find "ERROR" (any case) OR date patterns

Common patterns:
- Regex pattern: {"value": "\\b(error|fail|exception)\\b", "is_regex": true, "ignore_case": false, "is_word": false}
- Exact match: {"value": "timeout", "is_regex": true, "ignore_case": false, "is_word": false}

**Natural Language Interpretation:**
When the user provides natural language instructions, interpret them as follows:
- "error" → single filter for "error"
- "error or warning" → two filters, one for "error" and one for "warning"
- "case-insensitive ERROR" → set ignore_case: true, is_regex: true
- "match the word 'timeout'" → set is_word: true, is_regex: true, is_word: false
- "regex pattern \\d+" → set is_regex: true
- "find ERROR, WARNING, and CRITICAL" → three separate filters, but beware these are not the words, so `is_word` boolean value should be false.
"#)]
    async fn apply_search_filter(
        &self,
        Parameters(params): Parameters<SearchFilters>,
    ) -> Result<CallToolResult, RmcpError> {
        let (task_result_tx, task_result_rx) = mpsc::channel(1);
        let session_id = uuid::Uuid::parse_str(params.session_id.as_str()).map_err(|e| {
            RmcpError::new(
                ErrorCode(503),
                format!("Invalid session_id format: {}", e),
                None,
            )
        })?;
        let filters: Vec<processor::search::filter::SearchFilter> = params
            .filters
            .iter()
            .map(|filter| {
                processor::search::filter::SearchFilter::plain(filter.value.clone())
                    .regex(filter.is_regex)
                    .ignore_case(filter.ignore_case)
                    .word(filter.is_word)
            })
            .collect();
        let task = ApplySearchFilter {
            session_id,
            task_result_tx,
            filters,
        };
        // Send task over communication channel in a separate thread,
        // in future, we can skip match over task spawn
        match self.task_tx.send(task) {
            Ok(_) => log::warn!("🟢 MCP Server sent search task to MCP server"),
            Err(err) => log::error!(
                "Failed to send Search task to MCP server: ApplyFilter: {}",
                err
            ),
        };

        // Wait for the response from task over communication channel
        // based on the response send back the JSON response to client
        handle_task_response(task_result_rx, "apply_search_filters").await
    }

    #[tool(description = r#"This is generic function to 
"#)]
    async fn analyze_logs(
        &self,
        Parameters(params): Parameters<ValuesRequest>,
    ) -> Result<CallToolResult, RmcpError> {
        let (task_result_tx, task_result_rx) = mpsc::channel(1);
        let range: Option<RangeInclusive<u64>> = params.range.clone();
        let session_id = uuid::Uuid::parse_str(params.session_id.as_str()).map_err(|e| {
            RmcpError::new(
                ErrorCode(503),
                format!("Invalid session_id format: {}", e),
                None,
            )
        })?;
        let task = Tasks::GetChartLinePlots {
            dataset_len: params.dataset_len,
            range,
            session_id,
            task_result_tx,
        };
        self.task_tx.send(task).map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send GetChartLinePlots: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "get_chart_line_plots").await
    }

    #[tool(description = r#"Get histogram data for charts.

Returns a histogram of matches for the current search within an optional range.

**Input Parameters:**
- `dataset_len`: number of bars to produce
- `range`: optional {"start": u64, "end": u64} range in the stream

**Usage Examples:**
- Input: {"dataset_len": 60, "range": {"start": 0, "end": 100000}}
- Use case: Build a 60-bin histogram for the first 100k log entries
"#)]
    async fn get_chart_histogram(
        &self,
        Parameters(params): Parameters<MapRequest>,
    ) -> Result<CallToolResult, RmcpError> {
        let (task_result_tx, task_result_rx) = mpsc::channel(1);
        let range: Option<RangeInclusive<u64>> = params.range.clone();
        let session_id = uuid::Uuid::parse_str(params.session_id.as_str()).map_err(|e| {
            RmcpError::new(
                ErrorCode(503),
                format!("Invalid session_id format: {}", e),
                None,
            )
        })?;
        let task = Tasks::GetChartHistogram {
            dataset_len: params.dataset_len,
            range,
            session_id,
            task_result_tx,
        };
        self.task_tx.send(task).map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send GetChartHistogram: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "get_chart_histogram").await
    }

    #[tool(description = r#"Get line plot points for charts.

Returns point data for line plots based on extracted values within an optional range.

**Input Parameters:**
- `dataset_len`: number of points to produce
- `range`: optional {"start": u64, "end": u64} range in the stream

**Usage Examples:**
- Input: {"dataset_len": 120, "range": {"start": 5000, "end": 25000}}
- Use case: Build a 120-point chart for a specific time window
"#)]
    async fn get_chart_line_plots(
        &self,
        Parameters(params): Parameters<ValuesRequest>,
    ) -> Result<CallToolResult, RmcpError> {
        let (task_result_tx, task_result_rx) = mpsc::channel(1);
        let range = params.range.clone();
        let session_id = uuid::Uuid::parse_str(params.session_id.as_str()).map_err(|e| {
            RmcpError::new(
                ErrorCode(503),
                format!("Invalid session_id format: {}", e),
                None,
            )
        })?;
        let task = Tasks::GetChartLinePlots {
            dataset_len: params.dataset_len,
            range,
            session_id,
            task_result_tx,
        };
        self.task_tx.send(task).map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send GetChartLinePlots: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "get_chart_line_plots").await
    }
}

async fn handle_task_response(
    mut task_result_rx: mpsc::Receiver<Result<String, McpError>>,
    task_name: &str,
) -> Result<CallToolResult, RmcpError> {
    match task_result_rx.recv().await {
        Some(task_response) => match task_response {
            Ok(_success_message) => Ok(CallToolResult::success(vec![Content::json(format!(
                "{task_name} applied successfully"
            ))?])),
            Err(err) => {
                let err_msg = format!("{task_name} resulted in Error operation: {err}");
                Ok(CallToolResult::error(vec![Content::json(err_msg)?]))
            }
        },
        None => Err(RmcpError::new(
            ErrorCode::INTERNAL_ERROR,
            format!("Error while applying task {task_name}"),
            None,
        )),
    }
}
