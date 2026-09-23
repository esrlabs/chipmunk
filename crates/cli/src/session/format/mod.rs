//! Provide traits and method for formatting the parsed messages.

use parsers::LogMessage;

pub mod binary;
pub mod text;

/// Method definitions for formatting parsed messages and write them to
/// the provided [`std::io::Write`].
pub trait MessageFormatter {
    /// Format the message and then write it to the provided [`writer`].
    ///
    /// Returns whether the message reached the output: text output drops
    /// records rejected by the configured preset filter.
    fn write_msg<M>(&mut self, writer: impl std::io::Write, msg: &M) -> anyhow::Result<bool>
    where
        M: LogMessage;
}
