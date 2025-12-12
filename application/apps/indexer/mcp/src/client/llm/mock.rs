// A mock LLM client for testing purposes
// It simulates LLM behavior without making actual API calls / without a HTTP client
// The logic for processing messages is as follows:
// - User prompts received from the chipmunk core will cause the mock LLM to emit a ToolCall message:
//    LlmToClient::ToolCall ("apply_search_filter") with the prompt content as filters
// - ToolResult messages will be answered with a FinalResponse message containing the tool result

use log::warn;
use rmcp::serde_json::{self, json};
use tokio::time::{Duration, sleep};

use crate::client::conversation::LlmToClient;
use crate::{
    client::{
        conversation::{ChatMessage, ClientToLlm, Conversation},
        llm::LlmClient,
    },
    types::{McpError, SearchFilter},
};
pub struct MockLlmClient;

// Abstraction of LLM clients using the LlmClient trait
impl LlmClient for MockLlmClient {
    /// Process a conversation by taking appropriate action based on the last message and return a LLM response.
    async fn respond(&self, conversation: &Conversation) -> Result<LlmToClient, McpError> {
        MockLlmClient::respond(self, conversation).await
    }
}

impl MockLlmClient {
    /// Process a conversation take appropriate action based on the last message in the conversation
    /// and return a LLM response.
    /// For the mock client, we have hardcoded logic to simulate LLM behaviour
    pub async fn respond(&self, conversation: &Conversation) -> Result<LlmToClient, McpError> {
        warn!(
            "🟢 Mock LLM client processing message: {:?}",
            conversation.chat_messages().last()
        );
        match conversation.chat_messages().last() {
            Some(ChatMessage::ClientToLlm(message)) => match message {
                ClientToLlm::SystemPrompt { .. } => Err(McpError::Generic {
                    message: "Mock LLM client received a system prompt; nothing to do".into(),
                }),
                ClientToLlm::UserPrompt { content } => {
                    // Simulate LLM reasoning duration
                    warn!("⏰ Mock LLM client waits 5s ...");
                    sleep(Duration::from_secs(5)).await;

                    let filters = vec![SearchFilter {
                        value: content.clone(),
                        is_regex: false,
                        ignore_case: true,
                        is_word: false,
                    }];

                    let arguments: Option<serde_json::Map<String, serde_json::Value>> =
                        json!({ "filters": filters }).as_object().cloned();

                    // Return a ToolCall
                    Ok(LlmToClient::ToolCall {
                        tool_name: "apply_search_filter".into(),
                        arguments,
                    })
                }
                ClientToLlm::ToolResult { content } => {
                    // Simulate LLM reasoning duration
                    warn!("⏰ Mock LLM client waits 5s ...");
                    sleep(Duration::from_secs(5)).await;

                    // Return a FinalResponse
                    Ok(LlmToClient::FinalResponse {
                        content: format!("Final LLM Response: Tool result {:?}", content),
                    })
                }
            },
            _ => Err(McpError::Generic {
                message: "Mock LLM client received unsupported request".into(),
            }),
        }
    }
}
