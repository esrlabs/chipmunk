use rmcp::ServiceError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum McpError {
    // Client errors
    #[error("MCP service error: {0}")]
    Service(#[from] ServiceError),

    #[error("Connection failed: {message}")]
    Connection { message: String },

    #[error("Request timeout: {message}")]
    Timeout { message: String },

    #[error("Error while sending ChatMessage: {message}")]
    ChatError { message: String },

    // Server errors
    #[error("Tool execution failed: {message}")]
    ToolExecution { message: String },

    #[error("Setup failed: {message}")]
    Setup { message: String },

    // Generic
    #[error("{message}")]
    Generic { message: String },

    // Task execution errors
    #[error("Task execution failed: {0}")]
    TaskExecutionFailed(String),
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
