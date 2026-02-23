use crate::errors::McpError;
use crate::types::{LlmConfig, LlmProvider};
use ollama_rs::generation::chat::{
    ChatMessage, ChatMessageFinalResponseData, ChatMessageResponse, request::ChatMessageRequest,
};
use ollama_rs::generation::tools::{
    ToolCall, ToolCallFunction, ToolFunctionInfo, ToolInfo, ToolType,
};
use rmcp::model::ListToolsResult;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<Value>,
    tools: Vec<Value>,
    tool_choice: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    id: String,
    model: String,
    created: u64,
    object: String,
    choices: Vec<Choice>,
    usage: Option<Usage>,
}

#[derive(Debug, serde::Deserialize)]
struct Usage {
    prompt_tokens: u64,
    completion_tokens: u64,
}

#[derive(Debug, Deserialize)]
struct Choice {
    index: i32,
    message: ResponseMessage,
    finish_reason: String,
}

#[derive(Debug, Deserialize)]
struct ResponseMessage {
    role: String,
    content: Option<String>,
    tool_calls: Option<Vec<ToolCallResponse>>,
}

#[derive(Debug, Deserialize)]
struct ToolCallResponse {
    id: String,
    #[serde(rename = "type")]
    kind: String,
    function: FunctionCall,
}

#[derive(Debug, Deserialize)]
struct FunctionCall {
    name: String,
    arguments: String, // JSON-encoded string from OpenAI
}

pub async fn send_chat_messages(
    provider: LlmProvider,
    prompt: String,
    history: &mut Vec<ChatMessage>,
    tool_list: ListToolsResult,
) -> Result<ChatMessageResponse, McpError> {
    let tools = tool_list
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
    match provider {
        LlmProvider::Ollama => {
            let url = String::from("http://localhost:11434");

            // Basic URL parsing for ollama-rs
            let client = if url.starts_with("http") {
                let uri = url.parse::<reqwest::Url>().map_err(|e| McpError::Generic {
                    message: format!("Invalid URL: {}", e),
                })?;
                let host = format!(
                    "{}://{}",
                    uri.scheme(),
                    uri.host_str().unwrap_or("localhost")
                );
                let port = uri.port().unwrap_or(11434);
                ollama_rs::Ollama::new(host, port)
            } else {
                ollama_rs::Ollama::default()
            };

            let chat_message_request =
                ChatMessageRequest::new("llama3.2".to_string(), vec![ChatMessage::user(prompt)])
                    .tools(tools);

            client
                .send_chat_messages_with_history(history, chat_message_request)
                .await
                .map_err(|e| McpError::Generic {
                    message: e.to_string(),
                })
        }
        LlmProvider::OpenAI => {
            let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_else(|_| String::default());
            log::warn!("🤖 🤖 Sending prompt to open AI with API_KEY  => {api_key}");

            let mut messages = history
                .iter()
                .map(chat_message_to_openai)
                .collect::<Vec<Value>>();
            messages.push(chat_message_to_openai(&ChatMessage::user(prompt)));
            let tools = tools
                .iter()
                .map(tool_info_to_openai)
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

            openai_to_chat_message(openai_response)
            // In a real implementation, we would use reqwest to call OpenAI API
            // and map the response to ChatResponse.
            // For now, we'll return an error explaining it's a placeholder.
            // Err(McpError::Generic {
            //     message: "OpenAI provider selected. Please implement OpenAI API call in llm_client.rs using the provided API Key.".to_string()
            // })
        }
        LlmProvider::Antropic => todo!(),
        LlmProvider::Gemini => todo!(),
    }
}

fn tool_info_to_openai(tool: &ToolInfo) -> Value {
    serde_json::json!({
        "type": "function",
        "function": {
            "name":        tool.function.name,
            "description": tool.function.description,
            "parameters":  tool.function.parameters,
        }
    })
}

/// Maps an ollama-rs `ChatMessage` into the JSON shape expected by OpenAI.
fn chat_message_to_openai(msg: &ChatMessage) -> Value {
    serde_json::json!({
        "role":    msg.role,
        "content": msg.content,
    })
}

#[derive(Debug, thiserror::Error)]
pub enum ConversionError {
    #[error("OpenAI response has no choices")]
    NoChoices,
    #[error("Unknown role: {0}")]
    UnknownRole(String),
    #[error("Failed to parse tool arguments: {0}")]
    JsonParse(#[from] serde_json::Error),
}

pub fn openai_to_chat_message(resp: OpenAIResponse) -> Result<ChatMessageResponse, McpError> {
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
    })
}
