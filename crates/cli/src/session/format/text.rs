//! Structures and methods to write parsed message in text format.

use std::fmt::Write as _;

use anyhow::Context;

use parsers::LogMessage;
use processor::search::searchers::linear::LineSearcher;

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
///
/// When a preset filter is configured, messages whose canonical rendering does
/// not match any of its filters are dropped instead of being written.
#[derive(Debug)]
pub struct MsgTextFormatter {
    origin_msg_buffer: String,
    replaced_msg_buffer: String,
    /// Preset filters to apply, `None` when the session writes every message.
    filter: Option<LineSearcher>,
    /// The separator used for message columns in the parser used in indexer crates originally.
    indexer_cols_sep: &'static str,
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
    /// * `filter`: Preset filters to apply, `None` to write every message.
    pub fn new(
        indexer_cols_sep: &'static str,
        indexer_args_sep: char,
        columns_separator: String,
        argument_separator: String,
        filter: Option<LineSearcher>,
    ) -> Self {
        Self {
            origin_msg_buffer: String::new(),
            replaced_msg_buffer: String::new(),
            filter,
            columns_separator,
            argument_separator,
            indexer_cols_sep,
            indexer_args_sep,
        }
    }

    /// Whether the rendered message passes the configured preset filter.
    ///
    /// Sessions without a preset keep every message.
    fn matches_filters(&self) -> bool {
        self.filter
            .as_ref()
            .is_none_or(|filter| filter.is_match(&self.origin_msg_buffer))
    }
}

impl MessageFormatter for MsgTextFormatter {
    /// Format the given message by running the original formatting in chipmunk and then
    /// replace the special separator from chipmunk with the configured ones in the CLI tool.
    fn write_msg<M>(&mut self, mut writer: impl std::io::Write, msg: &M) -> anyhow::Result<bool>
    where
        M: LogMessage,
    {
        self.origin_msg_buffer.clear();
        self.replaced_msg_buffer.clear();

        write!(&mut self.origin_msg_buffer, "{msg}").context(WRITE_ERROR_MSG)?;

        if !self.matches_filters() {
            return Ok(false);
        }

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

        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use std::fmt::Display;

    use processor::search::filter::SearchFilter;

    use super::*;

    /// Log message rendering its canonical text as given.
    #[derive(serde::Serialize)]
    struct TestMsg(String);

    impl Display for TestMsg {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.write_str(&self.0)
        }
    }

    impl LogMessage for TestMsg {
        fn to_writer<W: std::io::Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
            writer.write(self.0.as_bytes())
        }
    }

    fn formatter(filter: Option<LineSearcher>) -> MsgTextFormatter {
        MsgTextFormatter::new(
            parsers::COLUMN_SEPARATOR,
            '\u{0005}',
            OUTPUT_COLUMNS_SEPARATOR_DEFAULT.to_owned(),
            OUTPUT_ARGS_SEPARATOR_DEFAULT.to_owned(),
            filter,
        )
    }

    fn searcher(value: &str) -> Option<LineSearcher> {
        let filter = SearchFilter::plain(value).ignore_case(true);

        Some(LineSearcher::from_filters(&[filter]).unwrap())
    }

    #[test]
    fn writes_every_message_without_filter() {
        let mut formatter = formatter(None);
        let mut output = Vec::new();

        for text in ["first line", "second line", "third line"] {
            let msg = TestMsg(text.to_owned());
            assert!(formatter.write_msg(&mut output, &msg).unwrap());
        }

        let output = String::from_utf8(output).unwrap();
        assert_eq!(output, "first line\nsecond line\nthird line\n");
    }

    #[test]
    fn drops_messages_rejected_by_filter() {
        let mut formatter = formatter(searcher("error"));
        let mut output = Vec::new();

        let matching = TestMsg("Runtime ERROR happened".to_owned());
        assert!(formatter.write_msg(&mut output, &matching).unwrap());
        assert_eq!(
            String::from_utf8(output.clone()).unwrap(),
            "Runtime ERROR happened\n"
        );

        let rejected = TestMsg("Everything is fine".to_owned());
        assert!(!formatter.write_msg(&mut output, &rejected).unwrap());
        assert_eq!(
            String::from_utf8(output).unwrap(),
            "Runtime ERROR happened\n",
            "Rejected message must not reach the output"
        );
    }

    #[test]
    fn filters_on_canonical_text_not_output_separators() {
        let canonical = format!("ecu2{sep}payload", sep = parsers::COLUMN_SEPARATOR);

        // The filter text spans the output column separator, which exists in the
        // written line but not in the canonical text the filter runs on.
        let mut on_output_text = formatter(searcher("ecu2 , payload"));
        let mut output = Vec::new();
        let msg = TestMsg(canonical.clone());
        assert!(!on_output_text.write_msg(&mut output, &msg).unwrap());
        assert!(output.is_empty());

        let mut on_canonical_text = formatter(searcher("ecu2\u{0004}payload"));
        assert!(on_canonical_text.write_msg(&mut output, &msg).unwrap());
        assert_eq!(String::from_utf8(output).unwrap(), "ecu2 , payload\n");
    }
}
