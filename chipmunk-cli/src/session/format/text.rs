use std::fmt::Write as _;

use anyhow::Context;
use parsers::LogMessage;

use super::MessageWriter;

use parsers::dlt::fmt::{
    DLT_ARGUMENT_SENTINAL as INEXER_DLT_ARGUMENT_SENTINAL,
    DLT_COLUMN_SENTINAL as INEXER_DLT_COLUMN_SENTINAL,
};

/// The default separator to used between the columns in the output of this CLI tool.
pub const OUTPUT_COLUMNS_SEPARATOR_DEFAULT: &str = " , ";

/// The default separator to used between the arguments in the payload column in
/// the output of this CLI tool.
pub const OUTPUT_ARGS_SEPARATOR_DEFAULT: &str = " ; ";

const WRITE_ERROR_MSG: &str = "Error while writing parsed message to buffer";

/// Struct to format log messages and write them as text into a file,
/// using cached buffers to avoid memory allocation on each iteration improving
/// the performance assuming it will be called inside a hot loop.
///
/// # Note:
/// Struct currently have support for DLT-messages only.
#[derive(Debug, Clone)]
pub struct MessageTextWriter {
    origin_msg_buffer: String,
    replaced_msg_buffer: String,
    columns_separator: String,
    argument_separator: String,
}

impl MessageTextWriter {
    pub fn new(columns_separator: String, argument_separator: String) -> Self {
        Self {
            origin_msg_buffer: String::new(),
            replaced_msg_buffer: String::new(),
            columns_separator,
            argument_separator,
        }
    }
}

impl MessageWriter for MessageTextWriter {
    /// Format the given message by running the original formatting in chipmunk and then
    /// replace the special separator from chipmunk with the configured ones in the CLI tool.
    fn write_msg(
        &mut self,
        mut writer: impl std::io::Write,
        msg: impl LogMessage,
    ) -> anyhow::Result<()> {
        self.origin_msg_buffer.clear();
        self.replaced_msg_buffer.clear();

        write!(&mut self.origin_msg_buffer, "{msg}").context(WRITE_ERROR_MSG)?;

        let rep_buff = &mut self.replaced_msg_buffer;

        for (idx, main) in self
            .origin_msg_buffer
            .split(INEXER_DLT_COLUMN_SENTINAL)
            .enumerate()
        {
            if idx != 0 {
                write!(rep_buff, "{}", self.columns_separator).context(WRITE_ERROR_MSG)?;
            }
            for (jdx, argument) in main.split(INEXER_DLT_ARGUMENT_SENTINAL).enumerate() {
                // TODO AAZ: Current solution in chipmunk puts empty arguments on some
                // of the messages.
                if jdx != 0 {
                    write!(rep_buff, "{}", self.argument_separator).context(WRITE_ERROR_MSG)?;
                }
                write!(rep_buff, "{argument}").context(WRITE_ERROR_MSG)?;
            }
        }

        writeln!(writer, "{}", self.replaced_msg_buffer)
            .context("Error while writing to output file")?;

        Ok(())
    }
}
