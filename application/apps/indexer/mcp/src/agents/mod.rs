use ollama_rs::generation::chat::{ChatMessage, ChatMessageResponse};
use rmcp::model::ListToolsResult;
use serde::{Deserialize, Serialize};

use crate::errors::McpError;

// pub mod claude;
pub mod ollama;
pub mod open_ai;

pub const LLM_API_KEY: &str = "LLM_KEY";

pub trait LlmAgent {
    fn new(model: &str, url: &str) -> Self;

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

#[derive(Debug, Default, Serialize, Deserialize)]
pub enum LlmProvider {
    #[default]
    Ollama,
    OpenAI,
    Claude,
}
