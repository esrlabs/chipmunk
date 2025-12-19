// LLM client abstraction layer
use crate::{
    client::conversation::{Conversation, LlmToClient},
    types::McpError,
};

pub mod mock;

/// Configuration used for creation of different LLM client
#[derive(Debug, Clone)]
pub enum LlmConfig {
    Mock,
    // Other LLM configurations can be added here. They may need other parameters like:
    // - API keys
    // - Model names
    // - temperature settings
    // - feature flags, ect.
    // // E.g.:
    // OpenAi { api_key: String, model: String },
}

// LLM client trait that LLM clients must implement
// Note: this causes the following warning:
//   use of `async fn` in public traits is discouraged as auto trait bounds cannot be specified
//   note: you can suppress this lint if you plan to use the trait only in your own code, or do not care about auto traits like `Send` on the `Future`
//   note: `#[warn(async_fn_in_trait)]` on by default
//   note: `#[warn(async_fn_in_trait)]` on by default
// We suppress the warning for now as all LLM clients are internal to the MCP client module.
// Alternatively we would need to use the async-trait crate.
#[allow(async_fn_in_trait)]
pub trait LlmClient {
    /// Process a conversation by taking appropriate action based on the last message and return a LLM response.
    async fn respond(&self, conversation: &Conversation) -> Result<LlmToClient, McpError>;
}

// LLM client abstraction wrapper providing a facade for different LLM client implementations
pub struct Llm<C: LlmClient> {
    client: C,
}

// LLM client abstraction wrapper implementation
impl<C: LlmClient> Llm<C> {
    pub fn new(client: C) -> Self {
        Self { client }
    }

    /// Forward processing of a conversation to the underlying LLM client implementation
    pub async fn process(&self, conversation: &Conversation) -> Result<LlmToClient, McpError> {
        self.client.respond(conversation).await
    }
}

// Implementation of LLM creation from configuration for the mock client
// TODO:[MCP] Can this be moved to the client modules? Via trait?
impl Llm<mock::MockLlmClient> {
    pub fn from_config(config: LlmConfig) -> Self {
        match config {
            LlmConfig::Mock => Llm::new(mock::MockLlmClient),
        }
    }
}
