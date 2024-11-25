use core::str;
use std::{iter, path::PathBuf};

use memchr::memchr;
use plugins_api::{
    log,
    parser::{InitError, ParseError, ParseReturn, ParseYield, ParsedMessage, Parser, ParserConfig},
    parser_export,
};

/// Simple struct that converts the given bytes into valid UTF-8 Strings line by line.
pub struct StringTokenizer;

impl StringTokenizer {
    /// Converts a slice from the given data to UTF-8 String stopping when it hit the first
    /// break-line character to return one line at a time.
    ///
    /// # Panic:
    /// The function will panic is the provided data is empty.
    fn parse_line(&self, data: &[u8]) -> Result<ParseReturn, ParseError> {
        assert!(!data.is_empty(), "Provided data can't be empty");

        let end_idx = memchr(b'\n', data).unwrap_or_else(|| data.len() - 1);

        let line = str::from_utf8(&data[..end_idx])
            .map_err(|err| ParseError::Parse(format!("Convertion to UTF-8 failed. Error {err}")))?;
        let msg = ParsedMessage::Line(String::from(line));
        let yld = ParseYield::Message(msg);

        Ok(ParseReturn::new((end_idx + 1) as u64, Some(yld)))
    }
}

/// Struct must implement [`Parser`] trait to be compiled as a parser plugin in Chipmunk.
impl Parser for StringTokenizer {
    fn create(
        general_configs: ParserConfig,
        config_path: Option<PathBuf>,
    ) -> Result<Self, InitError>
    where
        Self: Sized,
    {
        // Demonstrates log functionality
        log::debug!(
            "Plugin initialize called with the general settings: {:?}",
            general_configs
        );

        log::debug!(
            "Plugin initialize called with the optional custom config path: {:?}",
            config_path
        );

        // Plugin initialization.
        Ok(Self)
    }

    fn parse(
        &mut self,
        data: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseReturn>, ParseError> {
        let mut slice = &data[..];

        // Return early if function errors on the first call.
        let first_res = self.parse_line(slice)?;

        // Otherwise keep parsing and stop on first error, returning the parsed items at the end.
        let iter = iter::successors(Some(first_res), move |res| {
            slice = &slice[res.consumed as usize..];

            if slice.is_empty() {
                return None;
            }

            self.parse_line(slice).ok()
        });

        Ok(iter)
    }
}

parser_export!(StringTokenizer);
