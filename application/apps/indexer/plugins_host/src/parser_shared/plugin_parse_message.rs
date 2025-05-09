use definitions::LogMessage;
use serde::Serialize;

/// Represent the message of the parsed item returned by plugins.
#[derive(Debug, Serialize)]
pub struct PluginParseMessage {
    /// The content of the message as string.
    pub content: String,
}

impl From<PluginParseMessage> for LogMessage {
    fn from(msg: PluginParseMessage) -> Self {
        LogMessage::PlainText(msg.content)
    }
}
