use ollama_rs::generation::{
    chat::{ChatMessage, ChatMessageResponse, request::ChatMessageRequest},
    tools::{ToolFunctionInfo, ToolInfo, ToolType},
};
use rmcp::model::ListToolsResult;
use url::Url;

use crate::{config::AiConfig, errors::McpError};

// pub mod claude;
pub mod ollama;
pub mod open_ai;

pub const LLM_API_KEY: &str = "LLM_KEY";

pub trait LlmAgent {
    fn from_config(config: AiConfig) -> Self;

    async fn send_chat_message(
        &self,
        prompt: String,
        history: &mut Vec<ChatMessage>,
        tools: ListToolsResult,
    ) -> Result<ChatMessageResponse, McpError>;

    fn api_key() -> Option<String> {
        std::env::var(LLM_API_KEY).ok()
    }
}

pub trait ChatResponse {}

#[derive(Clone, Debug)]
pub struct GenericAgent {
    pub model: String,
    pub api_key: Option<String>,
    pub url: String,
}

impl LlmAgent for GenericAgent {
    fn from_config(config: AiConfig) -> Self {
        Self {
            model: config.model,
            url: config.url,
            api_key: config.api_key,
        }
    }

    // TODO: Change to generic API calling using reqwest and handle different providers based on the URL or a separate provider field in AiConfig
    async fn send_chat_message(
        &self,
        prompt: String,
        history: &mut Vec<ChatMessage>,
        tools: ListToolsResult,
    ) -> Result<ChatMessageResponse, McpError> {
        let url = Url::parse(self.url.as_str()).map_err(|err| McpError::Generic {
            message: format!("Error while parsing URL for the Generic Agent; {err:?}"),
        })?;

        let client = ollama_rs::Ollama::from_url(url);

        let mcp_tools = tools
            .tools
            .iter()
            .map(|tool| ToolInfo {
                tool_type: ToolType::Function,
                function: ToolFunctionInfo {
                    name: tool.name.to_string(),
                    description: tool
                        .description
                        .as_ref()
                        .map(|x| x.to_string())
                        .unwrap_or("No description".to_string()),
                    parameters: serde_json::from_value(serde_json::Value::Object(
                        (*tool.input_schema).clone(),
                    ))
                    .unwrap_or(schemars::json_schema!({"type": ["object", "null"]})),
                },
            })
            .collect::<Vec<ToolInfo>>();

        let chat_message_request =
            ChatMessageRequest::new(self.model.clone(), vec![ChatMessage::user(prompt)])
                .tools(mcp_tools);

        client
            .send_chat_messages_with_history(history, chat_message_request)
            .await
            .map_err(|e| McpError::Generic {
                message: e.to_string(),
            })
    }
}
