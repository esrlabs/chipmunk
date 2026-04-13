use ollama_rs::generation::{
    chat::{ChatMessage, ChatMessageResponse},
    tools::{ToolCall, ToolCallFunction, ToolFunctionInfo, ToolInfo, ToolType},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use url::Url;

use crate::{config::AiConfig, errors::McpError};

use super::LlmAgent;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAI {
    pub model: String,
    pub url: String,
    pub api_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenAIRequest {
    pub model: String,
    pub messages: Vec<Value>,
    pub tools: Vec<Value>,
    pub tool_choice: String,
}

#[derive(Debug, Deserialize)]
pub struct OpenAIResponse {
    pub id: String,
    pub model: String,
    created: u64,
    object: String,
    pub choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Debug, serde::Deserialize)]
struct Usage {
    prompt_tokens: u64,
    completion_tokens: u64,
}

#[derive(Debug, Deserialize)]
pub struct Choice {
    index: i32,
    pub message: ResponseMessage,
    finish_reason: String,
}

#[derive(Debug, Deserialize)]
pub struct ResponseMessage {
    pub role: String,
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCallResponse>>,
}

#[derive(Debug, Deserialize)]
pub struct ToolCallResponse {
    id: String,
    #[serde(rename = "type")]
    kind: String,
    pub function: FunctionCall,
}

#[derive(Debug, Deserialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: String, // JSON-encoded string from OpenAI
}

impl Default for OpenAI {
    fn default() -> Self {
        Self {
            model: String::from("gpt-4.1"),
            url: String::from("https://api.openai.com/v1/chat/completions"),
            api_key: Self::api_key(),
        }
    }
}

impl LlmAgent for OpenAI {
    fn from_config(config: AiConfig) -> Self {
        Self {
            model: config.model,
            url: config.url,
            api_key: config.api_key,
        }
    }

    async fn send_chat_message(
        &self,
        prompt: String,
        history: &mut Vec<ChatMessage>,
        tools: rmcp::model::ListToolsResult,
    ) -> Result<ChatMessageResponse, McpError> {
        if self.api_key.is_none() || self.api_key.as_ref().is_some_and(|key| key.is_empty()) {
            return Err(McpError::Generic {
                message: String::from("Missing API key for LLM Agent"),
            });
        }
        let api_key = self.api_key.clone().unwrap_or_default();
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
        let mut messages = history
            .iter()
            .map(chat_message_to_openai)
            .collect::<Vec<Value>>();
        messages.push(chat_message_to_openai(&ChatMessage::user(prompt)));

        let tools = mcp_tools
            .iter()
            .map(fetch_tool_info)
            .collect::<Vec<Value>>();

        let request_body = OpenAIRequest {
            model: "gpt-4.1".to_string(),
            messages: messages,
            tools: tools,
            tool_choice: "auto".to_string(),
        };
        log::warn!("🤙🏻 OpenAI Request: {request_body:?}");
        let client = reqwest::Client::new();
        let response = client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Content-Type", "application/json")
            .bearer_auth(&api_key)
            .json(&request_body)
            .send()
            .await
            .map_err(|err| McpError::ChatError {
                message: format!("{err:?}"),
            })?;

        let status = response.status();
        if !status.is_success() {
            let err_body = response.text().await.map_err(|err| McpError::Generic {
                message: format!("{err:?}"),
            })?;
            eprintln!("Error {status}: {err_body}");
            return Err(McpError::Generic {
                message: format!("Request failed with status {status}").into(),
            });
        }

        let openai_response: OpenAIResponse =
            response.json().await.map_err(|err| McpError::ChatError {
                message: format!("{err:?}"),
            })?;

        // --- Handle response / tool calls ----------------------------------------
        log::warn!("✅ Response ID: {}", openai_response.id);

        fetch_chat_message(openai_response)
    }
}

pub fn fetch_tool_info(tool: &ToolInfo) -> Value {
    serde_json::json!({
        "type": "function",
        "function": {
            "name":        tool.function.name,
            "description": tool.function.description,
            "parameters":  tool.function.parameters,
        }
    })
}

pub fn fetch_chat_message(resp: OpenAIResponse) -> Result<ChatMessageResponse, McpError> {
    let choice = resp.choices.into_iter().next().ok_or(McpError::ChatError {
        message: "Missing Choices from OpenAI Response".to_string(),
    })?;

    // ── Map tool_calls ──────────────────────────────────────────────────────
    let tool_calls: Option<Vec<ToolCall>> = choice.message.tool_calls.map(|tcs| {
        tcs.into_iter()
            .map(|tc| ToolCall {
                function: ToolCallFunction {
                    name: tc.function.name,
                    // OpenAI sends arguments as a JSON *string*;
                    // ollama-rs expects a serde_json::Value object.
                    arguments: serde_json::from_str(&tc.function.arguments)
                        .unwrap_or(serde_json::Value::Null),
                },
            })
            .collect()
    });

    // ── Map ChatMessage ─────────────────────────────────────────────────────
    // content is empty string when the model only returns tool_calls
    let content = choice.message.content.unwrap_or_default();

    let message = match choice.message.role.as_str() {
        "assistant" => ChatMessage::assistant(content),
        "user" => ChatMessage::user(content),
        "system" => ChatMessage::system(content),
        other => {
            return Err(McpError::ChatError {
                message: other.to_string(),
            });
        }
    };

    // Attach tool_calls if present. ChatMessage has a tool_calls field
    // that can be set after construction.
    let message = ChatMessage {
        tool_calls: tool_calls.unwrap_or_default(),
        ..message
    };

    Ok(ChatMessageResponse {
        model: resp.model,
        created_at: String::new(), // top-level field; detail is in final_data
        message,
        done: true,
        final_data: None,
        logprobs: None,
    })
}

/// Maps an ollama-rs `ChatMessage` into the JSON shape expected by OpenAI.
pub fn chat_message_to_openai(msg: &ChatMessage) -> Value {
    serde_json::json!({
        "role":    msg.role,
        "content": msg.content,
    })
}
