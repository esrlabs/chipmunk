use anyhow::Context;
use parsers::LogMessage;

use super::MessageWriter;

/// Struct to format log messages and write them as binary into a file.
#[derive(Debug, Clone, Default)]
pub struct BinaryMessageWriter {}

impl MessageWriter for BinaryMessageWriter {
    fn write_msg(
        &mut self,
        mut writer: impl std::io::Write,
        msg: impl LogMessage,
    ) -> anyhow::Result<()> {
        msg.to_writer(&mut writer)
            .context("Error while writing binary message")?;
        Ok(())
    }
}
