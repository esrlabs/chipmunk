use std::fmt::Write as _;

use anyhow::Context;
use parsers::LogMessage;

pub mod file;
pub mod socket;

//TODO AAZ: Temp solution to avoid changing code in chipmunk.
// Separators values used in indexer in Chipmunk.
const CHIPMUNK_DLT_COLUMN_SENTINAL: char = '\u{0004}';
const CHIPMUNK_DLT_ARGUMENT_SENTINAL: char = '\u{0005}';

// Separators to be used here in the CLI tool.
const CLI_OUT_MAIN_SEPARATOR: &str = " ||| ";
const CLI_OUT_ARG_SEPARATOR: &str = " &&& ";

const ERROR_MSG: &str = "Error while writing parsed message to buffer";

/// Struct to format log messages and write them as text into a file,
/// using cached buffers to avoid memory allocation on each iteration improving
/// the performance assuming it will be called inside a hot loop.
///
/// # Note:
/// Struct currently have support for DLT-messages only.
#[derive(Debug, Clone, Default)]
struct MessegeTextWriter {
    origin_msg_buffer: String,
    replaced_msg_buffer: String,
}

impl MessegeTextWriter {
    /// Format the given message by running the original formatting in chipmunk and then
    /// replace the special separator from chipmunk with the configured ones in the CLI tool.
    pub fn write_msg(
        &mut self,
        mut writer: impl std::io::Write,
        msg: impl LogMessage,
    ) -> anyhow::Result<()> {
        self.origin_msg_buffer.clear();
        self.replaced_msg_buffer.clear();

        write!(&mut self.origin_msg_buffer, "{msg}").context(ERROR_MSG)?;

        let rep_buff = &mut self.replaced_msg_buffer;

        for (idx, main) in self
            .origin_msg_buffer
            .split(CHIPMUNK_DLT_COLUMN_SENTINAL)
            .enumerate()
        {
            if idx != 0 {
                write!(rep_buff, "{CLI_OUT_MAIN_SEPARATOR}").context(ERROR_MSG)?;
            }
            for (jdx, argument) in main.split(CHIPMUNK_DLT_ARGUMENT_SENTINAL).enumerate() {
                // TODO AAZ: Current solution in chipmunk puts empty arguments on some
                // of the messages.
                if jdx != 0 {
                    write!(rep_buff, "{CLI_OUT_ARG_SEPARATOR}").context(ERROR_MSG)?;
                }
                write!(rep_buff, "{argument}").context(ERROR_MSG)?;
            }
        }

        writeln!(writer, "{}", self.replaced_msg_buffer)
            .context("Error while writing to output file")?;

        Ok(())
    }
}
