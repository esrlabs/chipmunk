use ollama_rs::generation::{
    chat::{ChatMessage, ChatMessageResponse, request::ChatMessageRequest},
    tools::{ToolFunctionInfo, ToolInfo, ToolType},
};
use rmcp::model::ListToolsResult;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use url::Url;

use super::LlmAgent;
use crate::{agents, errors::McpError};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Ollama {
    pub model: String,
    pub url: String,
    pub api_key: Option<String>,
}

impl Default for Ollama {
    fn default() -> Self {
        Self {
            model: String::from("llama3.2"),
            url: String::from("http://localhost:11434"),
            api_key: None,
        }
    }
}

impl LlmAgent for Ollama {
    fn new(model: &str, url: &str) -> Self {
        Self {
            model: String::from(model),
            url: String::from(url),
            api_key: None,
        }
    }

    async fn send_chat_message(
        &self,
        prompt: String,
        history: &mut Vec<ChatMessage>,
        tools: ListToolsResult,
    ) -> Result<ChatMessageResponse, McpError> {
        let url = Url::parse(self.url.as_str()).map_err(|err| McpError::Generic {
            message: format!("Error while parsing URL for the Ollama Agent; {err:?}"),
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
                    parameters: serde_json::from_value(Value::Object((*tool.input_schema).clone()))
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
