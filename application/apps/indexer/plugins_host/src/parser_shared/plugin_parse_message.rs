use parsers::api::LogRecordOutput;
use serde::Serialize;

/// Represent the message of the parsed item returned by plugins.
#[derive(Debug, Serialize)]
pub struct PluginParseMessage {
    /// The content of the message as string.
    pub content: String,
}
