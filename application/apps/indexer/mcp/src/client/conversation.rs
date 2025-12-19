// Simple model for storing the state of a chat conversation inside the MCP client

use rmcp::{
    model::Content,
    serde_json::{Map, Value},
};

#[derive(Debug)]
pub enum ChatMessage {
    ClientToLlm(ClientToLlm),
    LlmToClient(LlmToClient),
}

#[derive(Debug)]
pub enum ClientToLlm {
    SystemPrompt { content: String },
    UserPrompt { content: String },
    ToolResult { content: Vec<Content> },
}

#[derive(Debug)]
pub enum LlmToClient {
    ToolCall {
        tool_name: String,
        arguments: Option<Map<String, Value>>,
    },
    System {
        message: String,
    },
    FinalResponse {
        content: String,
    },
}
pub struct Conversation {
    chat_messages: Vec<ChatMessage>,
    // TODO:[MCP] keep track of steps?
    // TODO:[MCP] conversation ID=?
}

impl Conversation {
    /// Create a new conversation with an initial system prompt
    /// # Arguments
    /// * `system_prompt`: The system prompt to initialize the conversation with
    pub fn new(system_prompt: String) -> Self {
        Self {
            chat_messages: vec![ChatMessage::ClientToLlm(ClientToLlm::SystemPrompt {
                content: system_prompt,
            })],
        }
    }

    pub fn chat_messages(&self) -> &[ChatMessage] {
        &self.chat_messages
    }

    pub fn add_chat_message(&mut self, message: ChatMessage) {
        self.chat_messages.push(message);
    }
}
