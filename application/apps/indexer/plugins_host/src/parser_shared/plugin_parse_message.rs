use std::fmt::Display;

use parsers::LogMessage;
use serde::Serialize;

/// Represent the message of the parsed item returned by plugins.
#[derive(Debug, Serialize)]
pub struct PluginParseMessage {
    /// The content of the message as string.
    pub content: String,
}

impl Display for PluginParseMessage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.content)
    }
}

impl LogMessage for PluginParseMessage {
    fn to_writer<W: std::io::prelude::Write>(
        &self,
        writer: &mut W,
    ) -> Result<usize, std::io::Error> {
        //TODO AAZ: Make sure plugins messages should support export as binary.
        let bytes = self.content.as_bytes();
        let len = bytes.len();
        writer.write_all(bytes)?;
        Ok(len)
    }
}
