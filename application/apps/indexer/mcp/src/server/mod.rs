pub mod tasks;

pub const BIND_ADDRESS: &str = "127.0.0.1:8181";

use anyhow::Result;
use log::{error, warn};
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
use tokio::sync::{mpsc, oneshot};

use crate::{errors::McpError, types::*};
use tasks::{Tasks, Tasks::*};

#[derive(Clone, Debug)]
pub struct McpServer {
    task_tx: mpsc::Sender<Tasks>,
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
    pub fn new() -> (Self, mpsc::Receiver<Tasks>) {
        let (task_tx, task_rx) = mpsc::channel::<Tasks>(32);

        (
            Self {
                task_tx,
                tool_router: Self::tool_router(),
            },
            task_rx,
        )
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
                error!("🔴 MCP server error: {:?}", err);
            }
        });
        warn!("🟢 MCP server started");

        Ok(())
    }

    #[tool(description = r#"Generate SearchFilter objects for filtering logs.

This tool accepts one or more filter specifications and returns a list of SearchFilter objects.
Each filter can be customized with flags for regex matching, case sensitivity, and word boundaries.

**Input Parameters:**
- `filters`: An list of filter objects, where each object contains:
  - `value` (string): The text or pattern to search for
  - `is_regex` (boolean): true if the filter is a regular expression pattern
  - `ignore_case` (boolean): true for case-insensitive matching
  - `is_word` (boolean): true to match whole words only (word boundary matching)

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
        let (task_result_tx, task_result_rx) = oneshot::channel();
        let task = ApplySearchFilter {
            filters: params.filters.clone(),
            task_result_tx,
        };
        // Send task over communication channel in a separate thread,
        // in future, we can skip match over task spawn
        match self.task_tx.send(task).await {
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

    #[tool(description = r#"Drop current search results and clear search state.

**Input Parameters:** none

**Usage Examples:**
- Input: {}
- Use case: Clear results after changing filters or when starting a new analysis
"#)]
    async fn drop_search(
        &self,
        Parameters(_): Parameters<()>,
    ) -> Result<CallToolResult, RmcpError> {
        let (task_result_tx, task_result_rx) = oneshot::channel();
        let task = Tasks::DropSearch { task_result_tx };
        self.task_tx.send(task).await.map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send DropSearch: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "drop_search").await
    }

    #[tool(description = r#"Search for numeric values to build charts.

The filters are string expressions accepted by the value searcher. Each filter targets
lines that contain numeric values to extract for charting.

**Input Parameters:**
- `filters`: list of string filters

**Usage Examples:**
- Input: {"filters": ["time=", "latency="]}
- Use case: Extract time and latency values from logs for line plots

- Input: {"filters": ["RPM", "TEMP"]}
- Use case: Build value series for RPM and temperature signals
"#)]
    async fn search_values(
        &self,
        Parameters(params): Parameters<SearchValuesFilters>,
    ) -> Result<CallToolResult, RmcpError> {
        let (task_result_tx, task_result_rx) = oneshot::channel();
        let task = Tasks::SearchValues {
            filters: params.filters,
            task_result_tx,
        };
        self.task_tx.send(task).await.map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send SearchValues: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "search_values").await
    }

    #[tool(
        description = r#"Extract matches for chart series or downstream processing.

Uses the same filter structure as `apply_search_filter` and returns extracted values.

**Input Parameters:**
- `filters`: list of SearchFilter objects

**Usage Examples:**
- Input: {"filters": [{"value": "speed=", "is_regex": false, "ignore_case": false, "is_word": false}]}
- Use case: Extract numeric speed values from lines that contain `speed=`
"#
    )]
    async fn extract_matches(
        &self,
        Parameters(params): Parameters<SearchFilters>,
    ) -> Result<CallToolResult, RmcpError> {
        let (task_result_tx, task_result_rx) = oneshot::channel();
        let task = Tasks::ExtractMatches {
            filters: params.filters,
            task_result_tx,
        };
        self.task_tx.send(task).await.map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send ExtractMatches: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "extract_matches").await
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
        let (task_result_tx, task_result_rx) = oneshot::channel();
        let range = params.range.map(|r| (r.start, r.end));
        let task = Tasks::GetChartHistogram {
            dataset_len: params.dataset_len,
            range,
            task_result_tx,
        };
        self.task_tx.send(task).await.map_err(|e| {
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
        let (task_result_tx, task_result_rx) = oneshot::channel();
        let range = params.range.map(|r| (r.start, r.end));
        let task = Tasks::GetChartLinePlots {
            dataset_len: params.dataset_len,
            range,
            task_result_tx,
        };
        self.task_tx.send(task).await.map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send GetChartLinePlots: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "get_chart_line_plots").await
    }

    #[tool(description = r#"Export log data to a file.

Exports selected ranges to a file. Optionally selects columns when `spliter` and
`delimiter` are provided.

**Input Parameters:**
- `out_path`: output file path
- `ranges`: list of {"start": u64, "end": u64}
- `columns`: list of column indices to export
- `spliter`: optional record separator used to split log lines
- `delimiter`: optional output delimiter for columns

**Usage Examples:**
- Input: {"out_path": "/tmp/export.csv", "ranges": [{"start": 0, "end": 10000}], "columns": [0,2,4], "spliter": " ", "delimiter": ","}
- Use case: Export selected columns as CSV

- Input: {"out_path": "/tmp/export.log", "ranges": [{"start": 0, "end": 5000}], "columns": [], "spliter": null, "delimiter": null}
- Use case: Export raw lines without column selection
"#)]
    async fn export(
        &self,
        Parameters(params): Parameters<ExportRequest>,
    ) -> Result<CallToolResult, RmcpError> {
        let (task_result_tx, task_result_rx) = oneshot::channel();
        let ranges = params.ranges.iter().map(|r| (r.start, r.end)).collect();
        let task = Tasks::Export {
            out_path: params.out_path,
            ranges,
            columns: params.columns,
            spliter: params.spliter,
            delimiter: params.delimiter,
            task_result_tx,
        };
        self.task_tx.send(task).await.map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send Export: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "export").await
    }

    #[tool(description = r#"Export raw log data to a file.

Exports full log lines in the specified ranges without any column splitting.

**Input Parameters:**
- `out_path`: output file path
- `ranges`: list of {"start": u64, "end": u64}

**Usage Examples:**
- Input: {"out_path": "/tmp/export_raw.log", "ranges": [{"start": 20000, "end": 30000}]}
- Use case: Export a raw slice for debugging
"#)]
    async fn export_raw(
        &self,
        Parameters(params): Parameters<ExportRawRequest>,
    ) -> Result<CallToolResult, RmcpError> {
        let (task_result_tx, task_result_rx) = oneshot::channel();
        let ranges = params.ranges.iter().map(|r| (r.start, r.end)).collect();
        let task = Tasks::ExportRaw {
            out_path: params.out_path,
            ranges,
            task_result_tx,
        };
        self.task_tx.send(task).await.map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send ExportRaw: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "export_raw").await
    }

    #[tool(description = r#"Cancel a running operation by UUID.

Use the UUID from an in-flight operation to stop it.

**Input Parameters:**
- `target`: operation UUID as a string

**Usage Examples:**
- Input: {"target": "7f5f88b8-0a5a-4c3c-9c6b-23dbb39d9f33"}
- Use case: Cancel a long-running search or export
"#)]
    async fn cancel_operation(
        &self,
        Parameters(params): Parameters<CancelRequest>,
    ) -> Result<CallToolResult, RmcpError> {
        let (task_result_tx, task_result_rx) = oneshot::channel();
        let task = Tasks::CancelOperation {
            target: params.target,
            task_result_tx,
        };
        self.task_tx.send(task).await.map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send CancelOperation: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "cancel_operation").await
    }

    #[tool(description = r#"Get nearest log position for a stream offset.

Finds the closest indexed position to a raw stream offset.

**Input Parameters:**
- `position_in_stream`: byte offset or position in the stream

**Usage Examples:**
- Input: {"position_in_stream": 1048576}
- Use case: Jump to the nearest log entry around 1 MB into the stream
"#)]
    async fn get_nearest_position(
        &self,
        Parameters(params): Parameters<NearestPositionRequest>,
    ) -> Result<CallToolResult, RmcpError> {
        let (task_result_tx, task_result_rx) = oneshot::channel();
        let task = Tasks::GetNearestPosition {
            position_in_stream: params.position_in_stream,
            task_result_tx,
        };
        self.task_tx.send(task).await.map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send GetNearestPosition: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "get_nearest_position").await
    }
}

async fn handle_task_response(
    task_result_rx: oneshot::Receiver<Result<(), McpError>>,
    task_name: &str,
) -> Result<CallToolResult, RmcpError> {
    match task_result_rx.await {
        Ok(task_response) => match task_response {
            Ok(()) => Ok(CallToolResult::success(vec![Content::json(format!(
                "{task_name} applied successfully"
            ))?])),
            Err(err) => {
                let err_msg = format!("{task_name} resulted in Error operation: {err}");
                Ok(CallToolResult::error(vec![Content::json(err_msg)?]))
            }
        },
        Err(error) => Err(RmcpError::new(
            ErrorCode::INTERNAL_ERROR,
            format!("Error while applying task {task_name}: {error:?}"),
            None,
        )),
    }
}
