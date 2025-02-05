//! Structures and methods to write parsed message in text format.

use std::fmt::Write as _;

use anyhow::Context;

use parsers::LogMessage;

use super::MessageFormatter;

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
/// Formatting needs the columns and arguments separators used originally in each parser
/// to avoid any changes in indexer libraries before the implementation of this tool is
/// stabilized.
// TODO: Revisit this part once the UI part of this CLI tool is implemented.
#[derive(Debug, Clone)]
pub struct MsgTextFormatter {
    origin_msg_buffer: String,
    replaced_msg_buffer: String,
    /// The separator used for message columns in the parser used in indexer crates originally.
    indexer_cols_sep: char,
    /// The separator used for message payload arguments in the parser used in indexer
    /// crates originally.
    indexer_args_sep: char,
    /// The separator to be used for message columns in the output of this session.
    columns_separator: String,
    /// The separator to be used for message payload arguments in the output of this session.
    argument_separator: String,
}

impl MsgTextFormatter {
    /// Creates a new instance with the given arguments.
    ///
    /// * `indexer_cols_sep`: Separator used for message columns in the parser used in indexer
    ///   crates originally.
    /// * `indexer_args_sep`: Separator used for message payload arguments in the parser used
    ///   in indexer crates originally
    /// * `columns_separator`: Separator to be used for message columns in the output of this session.
    /// * `argument_separator`: Separator to be used for message payload arguments in the output of
    ///   this session.
    pub fn new(
        indexer_cols_sep: char,
        indexer_args_sep: char,
        columns_separator: String,
        argument_separator: String,
    ) -> Self {
        Self {
            origin_msg_buffer: String::new(),
            replaced_msg_buffer: String::new(),
            columns_separator,
            argument_separator,
            indexer_cols_sep,
            indexer_args_sep,
        }
    }
}

impl MessageFormatter for MsgTextFormatter {
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

        for (idx, cols) in self
            .origin_msg_buffer
            .split(self.indexer_cols_sep)
            .enumerate()
        {
            if idx != 0 {
                rep_buff.push_str(&self.columns_separator);
            }

            let mut main_iter = cols
                .split(self.indexer_args_sep)
                .filter(|e| !e.trim().is_empty());

            let Some(first) = main_iter.next() else {
                continue;
            };

            rep_buff.push_str(first);

            for argument in main_iter {
                rep_buff.push_str(&self.argument_separator);
                rep_buff.push_str(argument);
            }
        }

        writeln!(writer, "{}", self.replaced_msg_buffer)
            .context("Error while writing to output file")?;

        Ok(())
    }
}
