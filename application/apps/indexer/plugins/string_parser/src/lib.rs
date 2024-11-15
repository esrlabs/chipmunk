use std::{iter, path::PathBuf};

use memchr::memchr;
use plugins_api::{
    log,
    parser::{InitError, ParseError, ParseReturn, ParseYield, Parser, ParserConfig},
    parser_export,
};

/// Simple struct that converts the given bytes into UTF-8 Strings - including
/// invalid characters, line by line.
pub struct StringTokenizer;

impl StringTokenizer {
    /// Converts a slice from the given data to UTF-8 String stopping when it hit the first
    /// break-line character to return one line at a time.
    fn parse_line(&self, data: &[u8]) -> Result<ParseReturn, ParseError> {
        let res = if let Some(line_brk_idx) = memchr(b'\n', data) {
            let line = String::from_utf8_lossy(&data[..line_brk_idx]);
            let yld = ParseYield::Message(line.into());

            ParseReturn::new((line_brk_idx + 1) as u64, Some(yld))
        } else {
            let content = String::from_utf8_lossy(data);
            let yld = ParseYield::Message(content.into());

            ParseReturn::new(data.len() as u64, Some(yld))
        };

        Ok(res)
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
