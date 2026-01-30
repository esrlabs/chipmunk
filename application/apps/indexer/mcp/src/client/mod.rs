// pub mod conversation;
// pub mod llm;

use std::any::Any;

use log::{error, warn};
use ollama_rs::generation::chat::{ChatMessage, request::ChatMessageRequest};
use ollama_rs::generation::tools::{ToolFunctionInfo, ToolInfo, ToolType};
use rmcp::{
    RoleClient,
    model::{
        CallToolRequestParam, ClientCapabilities, ClientInfo, Implementation,
        InitializeRequestParam,
    },
    service::{RunningService, ServiceExt},
    transport::StreamableHttpClientTransport,
};
use schemars::Schema;
use serde_json::{Map, Value};
use tokio::{select, sync::mpsc};

use crate::{
    errors::McpError,
    // client::llm::{Llm, LlmClient, LlmConfig},
    types::{Prompt, Response},
};

// TODO:[MCP] store this in a single global location
pub const SERVER_ADDRESS: &str = "http://127.0.0.1:8181/mcp";

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

        warn!(
            "🟢 MCP client connected to MCP server: {:?}",
            mcp_service.peer_info()
        );

        let tools = mcp_service.list_tools(Default::default()).await?;
        tools.tools.iter().for_each(|tool| {
            warn!(
                "🟢 MCP client discovered tool: {} - {} (inputs: {:?})",
                tool.name,
                tool.description
                    .as_ref()
                    .map(|x| x.to_string())
                    .unwrap_or("No description".to_string()),
                tool.input_schema.keys().collect::<Vec<&String>>()
            );
        });

        // let llm = Llm::from_config(self.llm_config);

        tokio::spawn(async move {
            warn!("🟢 Starting MCP Client");

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
        warn!("✅ MCP client started");

        Ok(())
    }

    async fn run(
        mut prompt_rx: mpsc::Receiver<Prompt>,
        response_tx: mpsc::Sender<Response>,
        mut mcp_service: RunningService<RoleClient, InitializeRequestParam>,
        // llm: Llm<impl LlmClient>,
    ) -> Result<(), McpError> {
        // TODO:[MCP] System prompt probably needs to be tailored to our use case
        // Also this would need to be moved to the below loop, into the initial llm request / system prompt
        let ollama_client = ollama_rs::Ollama::default();
        let mut history = vec![];
        loop {
            select! {
                Some(chipmunk_request) = prompt_rx.recv() => {
                    let tools = mcp_service.list_tools(Default::default()).await?.tools.iter().map(|tool| {
                                ToolInfo {
                                    tool_type: ToolType::Function,
                                    function: ToolFunctionInfo {
                                        name: tool.name.to_string(),
                                        description: tool.description.as_ref().map(|x| x.to_string()).unwrap_or("No description".to_string()),
                                        parameters: serde_json::from_value(Value::Object((*tool.input_schema).clone())).unwrap_or(schemars::json_schema!({"type": ["object", "null"]}))
                                    }
                                }
                            }).collect::<Vec<ToolInfo>>();
                    let chat_message_request = ChatMessageRequest::new("llama3.2".to_string(), vec![ChatMessage::user(chipmunk_request)]).tools(tools);
                    let response = ollama_client.send_chat_message_with_history(history, chat_message_request);
                    match response.await {
                        Ok(res) => {
                            warn!("🟢 🥳 MCP Client received mock prompt response: {:?}", res);
                            let tool_calls = res.message.tool_calls.clone();
                            warn!("🟢 🥳 Tool Calls {:?}", tool_calls);
                            let tool_call_params = tool_calls.iter().map(|tool_call| {
                                CallToolRequestParam {
                                    name: tool_call.function.name.clone().into(),
                                    arguments: fetch_arguments(tool_call)
                                }

                            }).collect::<Vec<rmcp::model::CallToolRequestParam>>().first().cloned();
                            warn!("✔️ Tool Call Param {:?}", tool_call_params);
                            match tool_call_params {
                                Some(param) => {
                                    warn!("🟢 🥳 Calling tool with {:?}", param);
                                    let tool_result = mcp_service
                                    .call_tool(param)
                                    .await
                                    .map_err(|e| McpError::Generic {
                                        message: e.to_string(),
                                    })?;
                                    warn!("✔️ Tool Call Result {:?}", tool_result);
                                },
                                None => {}
                            }

                        },
                        _ => {
                            error!("🔴 MCP Client failed to get mock prompt response:");
                        }
                    }
                    println!("Chipmunk request {chipmunk_request:?}");
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
    let mut json_obj = rmcp::model::JsonObject::new();

    tool_call
        .function
        .arguments
        .clone()
        .as_object()
        .and_then(|obj| obj.get("filters"))
        .and_then(serde_json::Value::as_str)
        .and_then(|str_val| Some(str_val.replace(r"\\", r"\\\\").replace("\'", "\"")))
        .and_then(|str_val| serde_json::from_str::<serde_json::Value>(str_val.as_ref()).ok())
        .and_then(|val| val.as_array().cloned())
        .and_then(|arr| {
            Some(
                arr.iter()
                    .map(|item| SearchFilter {
                        value: item
                            .get("value")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("")
                            .to_string(),
                        is_regex: item
                            .get("is_regex")
                            .and_then(serde_json::Value::as_bool)
                            .unwrap_or(false),
                        ignore_case: item
                            .get("ignore_case")
                            .and_then(serde_json::Value::as_bool)
                            .unwrap_or(false),
                        is_word: item
                            .get("is_word")
                            .and_then(serde_json::Value::as_bool)
                            .unwrap_or(false),
                    })
                    .filter_map(|filter| serde_json::to_value(filter).ok())
                    .collect::<Vec<serde_json::Value>>(),
            )
        })
        .map(|arr| json_obj.insert("filters".to_string(), serde_json::Value::Array(arr)));

    warn!("☑️ Final call parameters are {json_obj:?}");
    Some(json_obj)
}
