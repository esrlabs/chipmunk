use log::info;
use rmcp::{
    ErrorData as McpError,
    handler::server::wrapper::Parameters,
    model::{CallToolResult, Content},
    tool, tool_router,
};

use super::{
    ai_config::AiConfig,
    ai_manager::ChipmunkAI,
    parameters::{FilterParameter, SearchFilter},
};

#[tool_router]
impl ChipmunkAI {
    #[allow(dead_code)]
    pub fn new(config: AiConfig) -> Self {
        Self {
            config,
            tool_router: Self::tool_router(),
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
    async fn apply_search_filters(
        &self,
        Parameters(param): Parameters<FilterParameter>,
    ) -> Result<CallToolResult, McpError> {
        let filters = param
            .filters
            .iter()
            .map(|f| SearchFilter {
                value: f.value.clone(),
                is_regex: f.is_regex,
                is_word: f.is_word,
                ignore_case: f.ignore_case,
            })
            .collect::<Vec<SearchFilter>>();
        info!("Received Filters from the LLM Agent: {filters:?}");
        // TODO: Apply filter via channel
        Ok(CallToolResult::success(vec![Content::json(
            "Applied filters to the logs",
        )?]))
    }
}
