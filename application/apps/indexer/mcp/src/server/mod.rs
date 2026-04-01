pub mod tasks;

pub const BIND_ADDRESS: &str = "127.0.0.1:8181";

use non_exhaustive::non_exhaustive;
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

use crate::{
    errors::McpError,
    tool_params::{
        AnalyzeLogsRequest, ChatResult, GrabLineParams, MapRequest, SearchFilters, ValuesRequest,
    },
    types::TaskResult,
};
use tasks::{Tasks, Tasks::*};

#[derive(Clone, Debug)]
pub struct McpServer {
    task_tx: broadcast::Sender<Tasks>,
    pub tool_router: ToolRouter<Self>,
}

#[tool_handler]
impl ServerHandler for McpServer {
    fn get_info(&self) -> ServerInfo {
        let capabilities = ServerCapabilities::builder()
            .enable_tools()
            .enable_resources()
            .enable_prompts()
            .build();
        ServerInfo::new(capabilities).with_instructions("Chipmunk MCP Server")
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

        let server_config = non_exhaustive! {StreamableHttpServerConfig {
            cancellation_token: ct.child_token(),
        }};
        let service = StreamableHttpService::new(
            {
                let server = self.clone();
                move || Ok(server.clone())
            },
            LocalSessionManager::default().into(),
            server_config,
        );

        let router = axum::Router::new().nest_service("/mcp", service);
        let tcp_listener = tokio::net::TcpListener::bind(BIND_ADDRESS).await?;

        tokio::spawn(async move {
            if let Err(err) = axum::serve(tcp_listener, router).await {
                log::error!("MCP server error: {:?}", err);
            }
        });
        log::debug!("MCP server started");

        Ok(())
    }

    //     #[tool(description = r#"Generate SearchFilter objects for filtering logs.

    // This tool accepts one or more filter specifications along with session_id and returns a list of SearchFilter objects.
    // Each filter can be customized with flags for regex matching, case sensitivity, and word boundaries.
    // Session id is present in the prompt and can be used by the LLM Model and sent back in the parameters.
    // This will help the MCP server to identify which session has requested for the filter and apply it to the correct session.

    // **Input Parameters:**
    // - `filters`: An list of filter objects, where each object contains:
    //   - `value` (string): The text or pattern to search for
    //   - `is_regex` (boolean): true if the filter is a regular expression pattern
    //   - `ignore_case` (boolean): False for case sensitive matching and vice versa, defaults to true.
    //   - `is_word` (boolean): true to match whole words only (word boundary matching)
    // - `session_id` (string): Unique identifier for the session requesting the filter, used to apply the filter to the correct session. Present in Chat message.

    // **Usage Examples:**

    // Single filter:
    // - Input: [{"value": "error", "is_regex": true, "ignore_case": false, "is_word": false}]
    // - Use case: Find exact matches of "error"

    // - Input: [{"value": "time=13", "is_regex": true, "ignore_case": false, "is_word": false}]
    // - Use case: Find lines in log where time is around 13

    // - Input: [{"value": "world bank", "is_regex": false, "ignore_case": true, "is_word": false}]
    // - Use case: Find lines in log containing world bank

    // Multiple filters:
    // - Input: [
    //     {"value": "ERROR", "is_regex": true, "ignore_case": true, "is_word": false},
    //     {"value": "\\d{4}-\\d{2}-\\d{2}", "is_regex": true, "ignore_case": false, "is_word": false}
    //   ]
    // - Use case: Find "ERROR" (any case) OR date patterns

    // Common patterns:
    // - Regex pattern: {"value": "\\b(error|fail|exception)\\b", "is_regex": true, "ignore_case": false, "is_word": false}
    // - Exact match: {"value": "timeout", "is_regex": true, "ignore_case": false, "is_word": false}

    // **Natural Language Interpretation:**
    // When the user provides natural language instructions, interpret them as follows:
    // - "error" → single filter for "error"
    // - "error or warning" → two filters, one for "error" and one for "warning"
    // - "case-insensitive ERROR" → set ignore_case: true, is_regex: true
    // - "match the word 'timeout'" → set is_word: true, is_regex: true, is_word: false
    // - "regex pattern \\d+" → set is_regex: true
    // - "find ERROR, WARNING, and CRITICAL" → three separate filters, but beware these are not the words, so `is_word` boolean value should be false.
    // "#)]
    #[tool(
        description = r#"Apply one or more search filters to filter log lines in the current session.

Filters are applied with OR logic — a log line is shown if it matches ANY filter.
Each filter targets a text pattern or regex. The session_id ties the filter to the correct log viewer session.

---

PARAMETERS

session_id (string, required)
  The session UUID provided in the user's message. Must be a valid UUID (e.g. "550e8400-e29b-41d4-a716-446655440000").
  Always extract and forward this exactly as provided — do not generate or modify it.

filters (array, required, min 1 item)
  List of filter objects. Each object has:

  value (string, required)
    The text or regex pattern to match against log lines.
    For regex: escape backslashes (e.g. "\\d+" not "\d+").

  is_regex (boolean, required)
    true  → treat `value` as a regular expression
    false → treat `value` as a plain text substring

  ignore_case (boolean, required)
    true  → case-insensitive match (default for most searches)
    false → case-sensitive match (use when casing is significant, e.g. "ERROR" vs "error")

  is_word (boolean, required)
    true  → match whole words only (wraps pattern in \b word boundaries)
    false → match anywhere in the line (including inside words)

---

NUMERIC AND COMPARISON EXPRESSIONS

  Regex cannot perform numeric comparisons (>=, <=, >, <).
  When the user writes expressions like `time>=10.0ms`, `latency>500`, or `duration<=2s`,
  translate them into a regex that matches the relevant numeric field, and inform the user
  that results are approximate (pattern-based, not mathematically exact).

  STRATEGY: Match the field name and capture plausible numeric values using regex.
  Let the user know the filter is approximate and they may need to refine it.

  TRANSLATION EXAMPLES

  "time>=10.0ms"
    → Inform user: "Regex cannot do >= comparisons. Applying a pattern that matches
      time=10.x, time=1x.x, time=2x.x etc. Results are approximate."
    → filters: [{"value": "time=([1-9]\\d+|10)\\.?\\d*ms", "is_regex": true, "ignore_case": false, "is_word": false}]

  "latency>500ms"
    → Match 3-digit numbers starting with 5-9 (500–999) and all 4+ digit numbers
    → filters: [{"value": "latency=([5-9]\\d{2}|\\d{4,})ms", "is_regex": true, "ignore_case": false, "is_word": false}]

  "duration<=2s"  
    → Match 0s, 1s, 2s (integers) or decimals like 1.5s, 0.9s
    → filters: [{"value": "duration=([01](\\.\\d+)?|2(\\.0+)?)s", "is_regex": true, "ignore_case": false, "is_word": false}]

  ALWAYS accompany a comparison-translated filter with a message like:
    "⚠️ Regex cannot evaluate >= numerically. This filter approximates lines where
     [field] is likely >= [value], but edge cases may appear or be missed.
     Consider narrowing with a more specific pattern if needed."

---

NATURAL LANGUAGE → PARAMETER MAPPING

  "error"                          → [{value:"error", is_regex:false, ignore_case:true, is_word:false}]
  "exact ERROR (case-sensitive)"   → [{value:"ERROR", is_regex:false, ignore_case:false, is_word:false}]
  "whole word timeout"             → [{value:"timeout", is_regex:false, ignore_case:true, is_word:true}]
  "error or warning"               → two filters: one for "error", one for "warning"
  "ERROR, WARNING, CRITICAL"       → three filters, one per term, is_word:false (labels, not word-boundary tokens)
  "lines with a date like 2024-01" → [{value:"\\d{4}-\\d{2}", is_regex:true, ignore_case:false, is_word:false}]
  "time around 13"                 → [{value:"time=13", is_regex:true, ignore_case:false, is_word:false}]
  "error or exception (regex)"     → [{value:"error|exception", is_regex:true, ignore_case:true, is_word:false}]

---

DECISION RULES

  1. Use is_regex:true when the user mentions "regex", uses special characters (. * + ? [ ] ( ) | \ ^ $), or needs alternation (a|b).
  2. Use is_regex:false for plain keyword searches — simpler and less error-prone.
  3. Use ignore_case:false only when the user says "case-sensitive" or "exact case".
  4. Use is_word:true only when the user says "whole word" or "word boundary".
  5. Multiple keywords in one request → one filter object per keyword (OR semantics).
  6. Never combine unrelated patterns into one regex when separate filters express intent more clearly.

---

EXAMPLES

Single keyword (case-insensitive):
  filters: [{"value": "timeout", "is_regex": false, "ignore_case": true, "is_word": false}]

Whole-word match:
  filters: [{"value": "fail", "is_regex": false, "ignore_case": true, "is_word": true}]

Case-sensitive exact label:
  filters: [{"value": "CRITICAL", "is_regex": false, "ignore_case": false, "is_word": false}]

Two keywords (OR):
  filters: [
    {"value": "error",   "is_regex": false, "ignore_case": true, "is_word": false},
    {"value": "warning", "is_regex": false, "ignore_case": true, "is_word": false}
  ]

Regex — date pattern:
  filters: [{"value": "\\d{4}-\\d{2}-\\d{2}", "is_regex": true, "ignore_case": false, "is_word": false}]

Regex — multiple severities:
  filters: [{"value": "error|warn|fatal", "is_regex": true, "ignore_case": true, "is_word": false}]
"#
    )]
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

    #[tool(
        description = r#"Analyze logs iteratively by requesting specific line ranges and optionally applying an action.

Use this tool in a loop:
1) Request a line `range` to inspect raw logs.
2) Review returned lines.
3) Repeat with another range as needed.
4) On final call, optionally execute an action.

Supported actions:
- `none`: only return requested lines.
- `apply_filter`: apply one or more search filters to the session.
- `jump_to_line`: move UI focus to a specific log line.

Input parameters:
- `session_id` (string): target session UUID.
- `range` (optional): {"start": u64, "end": u64} inclusive line range to fetch.
- `action` (optional): one of `none`, `apply_filter`, `jump_to_line`.
- `filters` (optional): list of filters, required for `apply_filter`.
- `jump_to_line` (optional): target line index, required for `jump_to_line`.
- `note` (optional): free-form summary/note from the LLM for traceability.
"#
    )]
    async fn analyze_logs(
        &self,
        Parameters(params): Parameters<AnalyzeLogsRequest>,
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

        let task = Tasks::AnalyzeLogFile {
            range,
            session_id,
            action: params.action,
            filters,
            jump_to_line: params.jump_to_line,
            note: params.note,
            task_result_tx,
        };
        self.task_tx.send(task).map_err(|e| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Failed to send AnalyzeLogFile: {e}"),
                None,
            )
        })?;
        handle_task_response(task_result_rx, "analyze_logs").await
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

    #[tool(description = r#"Retrieve log lines within a specified range.

    Fetches raw log lines from the current session based on the provided line range.
    This tool is useful for inspecting specific sections of logs during iterative analysis.

    **Input Parameters:**
    - `range` (RangeInclusive<u64>): Inclusive range of line numbers to retrieve.
        Usually represented as range(0, 100) which translates to std::ops::RangeInclusive::new(0, 100) in rust
        In following Usage examples range represented as 
        - range(5000, 5050) => std::ops::RangeInclusive::new(5000, 5050)
    - `session_id`: Session ID that prompt contains

    **Output:**
    Returns a vector of strings, where each string represents a log line within the specified range.

    **Usage Examples:**
    - Sample Prompts
        - Retrive first 100 lines from log file.
        - Grab first 100 lines from log
        - Get me 100 lines from file
        - Select (first) 100 lines from the file
    - Input: { session_id: session_id, range: range(0, 100)}
    - Use case: Fetch the first 100 lines of the log file

     - Sample Prompts
        - Retrive lines between 5000 and 5050
        - Grab first 50 lines from log starting line index 5000
        - Select (first) 50 lines from the file starting at line number 5000
    - Input: { session_id: session_id, range: range(5000, 5050))
    - Use case: Inspect a specific section of 51 lines in the middle of the log

    - Input: { session_id: session_id, range: range(1000, 1000) }
    - Use case: Retrieve a single specific line

    **Notes:**
    - Both start and end indices are inclusive
    - Line numbers are 0-indexed
    - If the range exceeds available lines, only existing lines are returned
    - Invoked by the LLM via the MCP protocol for interactive log exploration

    "#)]
    async fn grab_lines(
        &self,
        Parameters(params): Parameters<GrabLineParams>,
    ) -> Result<CallToolResult, RmcpError> {
        let session_id = uuid::Uuid::parse_str(params.session_id.as_str()).map_err(|_| {
            RmcpError::new(
                ErrorCode::INVALID_PARAMS,
                format!("Error while fetching the session ID from parameters"),
                None,
            )
        })?;
        let (task_result_tx, task_result_rx) = mpsc::channel(1);
        let task = Tasks::GrabLines {
            session_id,
            range: params.range,
            task_result_tx: task_result_tx.clone(),
        };
        self.task_tx.send(task).map_err(|_| {
            RmcpError::new(
                ErrorCode::INTERNAL_ERROR,
                format!("Error while sending the task to app"),
                None,
            )
        })?;

        handle_task_response(task_result_rx, "grab_lines").await
    }

    #[tool(
        description = r#"Complete an MCP chat workflow and publish the final outcome.

This tool must be called as the final step after all analysis or data-retrieval tool calls are done.
It marks the MCP tool-call lifecycle as complete for a session and returns a final payload that the
client can treat as the authoritative chat outcome.

This tool response should contain the answer to the question that user asked initially. For example
if user asked to perform some task then tool response should contain the summary of all the operations
and final answer if there should be any.
If user has asked, say to find summary, or analyze data then this tool response should contain the answer.
In general response should not be empty and should contain the meaningful message for the end user.

Use this tool to:
- signal that no further MCP tool calls are required for the current chat turn,
- provide the final user-facing summary/result text in the response,
- explicitly communicate whether the overall chat operation succeeded or failed.

Input parameters:
- `session_id` (string): UUID of the session whose chat workflow is being finalized.
- `result` (string): Final message/result produced by the chat workflow. This can be either:
    - a success summary (answer, findings, recommendation), or
    - an error summary describing what failed and why.
- `success` (boolean): Final status flag for the chat workflow.
    - `true` means the workflow completed successfully.
    - `false` means the workflow ended with an error or incomplete state.

Output:
- Echoes the same `ChatResult` JSON payload (`session_id`, `result`, `success`) as the final MCP response.

Usage examples:
- Success:
    - Input: {"session_id":"<uuid>","result":"Found root cause in lines 1200-1218.","success":true}
- Error:
    - Input: {"session_id":"<uuid>","result":"Failed to parse session_id: invalid UUID.","success":false}
"#
    )]
    async fn complete_chat(
        &self,
        Parameters(params): Parameters<ChatResult>,
    ) -> Result<CallToolResult, RmcpError> {
        println!("***DEBUG: Finished chat analysis");
        Ok(CallToolResult::success(vec![Content::json(params)?]))
    }
}

async fn handle_task_response(
    mut task_result_rx: mpsc::Receiver<Result<TaskResult, McpError>>,
    task_name: &str,
) -> Result<CallToolResult, RmcpError> {
    let task_result = task_result_rx.recv().await;

    match task_result {
        None => Err(RmcpError::new(
            ErrorCode::INTERNAL_ERROR,
            format!("Error while applying task {task_name}"),
            None,
        )),
        Some(result) => match result {
            Ok(TaskResult::Complete(_m)) => {
                let message = format!("Completed `{task_name}` tool call successfully");
                Ok(CallToolResult::success(vec![Content::json(message)?]))
            }
            Ok(TaskResult::AnalyzeLogs(log_result)) => {
                let message = format!("Result for {task_name}\n\n {log_result:?}");
                Ok(CallToolResult::success(vec![Content::json(message)?]))
            }
            Ok(TaskResult::RequestLines(range)) => {
                Ok(CallToolResult::success(vec![Content::json(range)?]))
            }
            Ok(TaskResult::Failed(error_msg)) => {
                Ok(CallToolResult::error(vec![Content::json(error_msg)?]))
            }
            Err(err) => {
                let err_msg = format!("{task_name} resulted in Error operation: {err}");
                Ok(CallToolResult::error(vec![Content::json(err_msg)?]))
            }
        },
    }
}
