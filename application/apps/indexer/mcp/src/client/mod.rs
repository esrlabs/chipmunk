// pub mod conversation;
// pub mod llm;

pub mod agents;

use log::{error, warn};
use ollama_rs::generation::chat::ChatMessage;
use rmcp::{
    RoleClient,
    model::{
        CallToolRequestParam, ClientCapabilities, ClientInfo, Implementation,
        InitializeRequestParam,
    },
    service::{RunningService, ServiceExt},
    transport::StreamableHttpClientTransport,
};
use serde_json::Value;
use tokio::{select, sync::mpsc};

use crate::{
    chat::Prompt,
    // client::llm::{Llm, LlmClient, LlmConfig},
    errors::McpError,
    types::Response,
};
use agents::LlmAgent;

// TODO:[MCP] store this in a single global location
pub const SERVER_ADDRESS: &str = "http://127.0.0.1:8181/mcp";

const SYSTEM_PROMPT: &str = r#"You are a log analysis assistant for Chipmunk.
Your goal is to help users analyze logs using the provided tools.
When you receive a prompt, often accompanied by sample log lines, analyze the user's intent and call the appropriate tool.

Rules for tool usage:
1. 'apply_search_filter': Use this for filtering logs.
   - 'value' is the search pattern.
   - 'is_regex' should be true if you use regex patterns (like \d+, [A-Z], etc.).
   - 'ignore_case' should be true if the user doesn't specify case sensitivity.
   - 'is_word' should be true if the user wants to match whole words only. Default to false.
2. If the user asks for a chart or values, use 'search_values' or 'get_chart_histogram'.
3. Always be precise with the parameters. If a parameter is not specified, use common-sense defaults.
4. Output ONLY the tool call if that's the primary action.

Sample log lines provided at the end of the prompt show the context and format of the current session. Use them to craft better search patterns.
"#;

pub struct McpConfig {
    pub url: String,
}

pub struct McpClient {
    prompt_rx: mpsc::Receiver<Prompt>,
    response_tx: mpsc::Sender<Response>,
}

impl McpClient {
    pub fn new() -> (Self, mpsc::Sender<Prompt>, mpsc::Receiver<Response>) {
        let (response_tx, response_rx) = mpsc::channel::<Response>(32);
        let (prompt_tx, prompt_rx) = mpsc::channel::<Prompt>(32);

        (
            Self {
                prompt_rx,
                response_tx,
            },
            prompt_tx,
            response_rx,
        )
    }

    pub async fn start(self) -> Result<(), McpError> {
        // Setup MCP connection
        let transport = StreamableHttpClientTransport::from_uri(SERVER_ADDRESS);

        // TODO:[MCP] match with MCP server definition
        let client_info = ClientInfo {
            protocol_version: Default::default(),
            capabilities: ClientCapabilities::builder()
                .enable_elicitation()
                .enable_roots()
                .enable_sampling()
                .build(),
            client_info: Implementation {
                name: String::from("mcp-client"),
                title: Some(String::from("Chipmunk MCP Client")),
                version: String::from(env!("CARGO_PKG_VERSION")),
                website_url: None,
                icons: None,
            },
        };

        let mcp_service = client_info
            .serve(transport)
            .await
            .map_err(|e| McpError::Generic {
                message: e.to_string(),
            })?;

        // let llm = Llm::from_config(self.llm_config);

        tokio::spawn(async move {
            if let Err(e) = McpClient::run(
                self.prompt_rx,
                self.response_tx,
                mcp_service,
                // llm,
            )
            .await
            {
                error!("MCP client event loop ended: {:?}", e);
            }
        });
        Ok(())
    }

    async fn run(
        mut prompt_rx: mpsc::Receiver<Prompt>,
        response_tx: mpsc::Sender<Response>,
        mcp_service: RunningService<RoleClient, InitializeRequestParam>,
        // llm: Llm<impl LlmClient>,
    ) -> Result<(), McpError> {
        // TODO:[MCP] System prompt probably needs to be tailored to our use case
        // Also this would need to be moved to the below loop, into the initial llm request / system prompt
        let mut history = vec![ChatMessage::system(SYSTEM_PROMPT.to_string())];
        loop {
            select! {
                Some(prompt) = prompt_rx.recv() => {
                    let message = format!("User prompt: {}\n\n session_id:\n{}", prompt.message, prompt.id);

                    history.push(ChatMessage::user(message.clone()));

                        let tools = mcp_service.list_tools(Default::default()).await?;
                        let response = agents::GenericAgent::from_config(prompt.config.clone()).send_chat_message(message.clone(), &mut history, tools).await;

                        match response {
                            Ok(res) => {
                                let tool_calls = res.message.tool_calls.clone();
                                println!("🤙🏻 Received Tool Call/s from LLM {tool_calls:?}");

                                if tool_calls.is_empty() {
                                    if !res.message.content.is_empty() {
                                        let _ = response_tx.send(res.message.content.clone()).await;
                                    }
                                    break;
                                }

                                for tool_call in tool_calls {
                                    let param = CallToolRequestParam {
                                        name: tool_call.function.name.clone().into(),
                                        arguments: fetch_arguments(&tool_call)
                                    };

                                    match mcp_service.call_tool(param).await {
                                        Ok(tool_result) => {
                                            println!("✅ Tool call result for {}: {:?}", tool_call.function.name, tool_result);
                                            let _ = response_tx.send(format!("Tool call result for {}: {:?}", tool_call.function.name, tool_result)).await;
                                        },
                                        Err(e) => {
                                            error!("🔴 Tool call failed: {:?}", e);
                                        }
                                    }
                                }
                            },
                            Err(err) => {
                                error!("🔴 MCP Client failed to get mock prompt response: {err:?}");
                            }
                        }
                    // println!("Chipmunk request {chipmunk_request:?}");
                }
            }
        }

        #[allow(unreachable_code)]
        Ok(())
    }
}

fn fetch_arguments(
    tool_call: &ollama_rs::generation::tools::ToolCall,
) -> Option<rmcp::model::JsonObject> {
    let args_value = tool_call.function.arguments.clone();
    let args_value = normalize_args_value(args_value)?;
    let args_object = match args_value {
        Value::Object(map) => map,
        Value::Null => {
            warn!(
                "⚠️ Tool call arguments are null; using empty parameters for {}",
                tool_call.function.name
            );
            serde_json::Map::new()
        }
        _ => {
            warn!(
                "⚠️ Tool call arguments are not an object for {}",
                tool_call.function.name
            );
            return None;
        }
    };

    let mut json_obj = rmcp::model::JsonObject::new();
    for (key, value) in args_object {
        json_obj.insert(key, normalize_json_value(value));
    }

    warn!("☑️ Final call parameters are {json_obj:?}");
    Some(json_obj)
}

fn normalize_args_value(value: Value) -> Option<Value> {
    match value {
        Value::String(raw) => parse_jsonish_string(&raw),
        other => Some(other),
    }
}

fn parse_jsonish_string(raw: &str) -> Option<Value> {
    let mut trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("null") {
        return Some(Value::Null);
    }
    if trimmed.starts_with("```") {
        if let Some(end) = trimmed.rfind("```") {
            trimmed = &trimmed[3..end];
            if trimmed.trim_start().starts_with("json") {
                trimmed = trimmed.trim_start_matches("json").trim();
            }
        }
    }
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("null") {
        return Some(Value::Null);
    }
    let parsed = serde_json::from_str::<Value>(trimmed).ok()?;
    match parsed {
        Value::String(inner) => serde_json::from_str::<Value>(inner.trim()).ok(),
        other => Some(other),
    }
}

fn normalize_json_value(value: Value) -> Value {
    match value {
        Value::String(raw) => serde_json::from_str::<Value>(&raw).unwrap_or(Value::String(raw)),
        Value::Array(items) => Value::Array(items.into_iter().map(normalize_json_value).collect()),
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(k, v)| (k, normalize_json_value(v)))
                .collect(),
        ),
        other => other,
    }
}
