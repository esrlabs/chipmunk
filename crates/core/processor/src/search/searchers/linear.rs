//! Includes utilities for searching matches in a string.
//! Primarily used for nested searches, such as filtering results from a primary search.

use std::str::FromStr;

use anstyle_parse::{DefaultCharAccumulator, Parser, Perform};
use memchr::memchr;
use regex::Regex;

use crate::search::{error::SearchError, filter, filter::SearchFilter};

/// Represents a utility for searching matches in a string.
/// Primarily used for nested searches, such as filtering results from a primary search.
#[derive(Debug)]
pub struct LineSearcher {
    /// A compiled regular expression used for matching lines.
    re: Regex,
}

impl LineSearcher {
    /// Creates a new `LineSearcher` instance using the provided search filter.
    ///
    /// # Arguments
    ///
    /// * `filter` - A reference to a `SearchFilter` that specifies the search criteria.
    ///
    /// # Returns
    ///
    /// * `Ok(Self)` - If the regular expression is successfully created.
    /// * `Err(SearchError)` - If the regular expression cannot be compiled.
    pub fn new(filter: &SearchFilter) -> Result<Self, SearchError> {
        let regex_as_str = filter::as_regex(filter);
        Ok(Self {
            re: Regex::from_str(&regex_as_str).map_err(|err| {
                SearchError::Regex(format!("Failed to create regex for {regex_as_str}: {err}"))
            })?,
        })
    }

    /// Checks if the given line matches the internal regular expression.
    ///
    /// # Arguments
    ///
    /// * `ln` - A string slice representing the line to be checked.
    ///
    /// # Returns
    ///
    /// * `true` - If the line matches the regular expression.
    /// * `false` - Otherwise.
    pub fn is_match(&self, ln: &str) -> bool {
        // Check raw text first to avoid ANSI strip's parsing and allocation
        // for normal matches.
        if self.re.is_match(ln) {
            return true;
        }

        // ANSI codes can split visible text.
        // We retry only when an escape code is present.
        if memchr(0x1b, ln.as_bytes()).is_none() {
            return false;
        }

        self.re.is_match(&strip_ansi(ln))
    }
}

fn strip_ansi(content: &str) -> String {
    let mut parser = Parser::<DefaultCharAccumulator>::new();
    let mut visible = VisibleText(String::with_capacity(content.len()));
    for byte in content.bytes() {
        parser.advance(&mut visible, byte);
    }
    visible.0
}

struct VisibleText(String);

impl Perform for VisibleText {
    fn print(&mut self, character: char) {
        self.0.push(character);
    }

    fn execute(&mut self, byte: u8) {
        if matches!(byte, b'\t' | b'\n' | b'\r') {
            self.0.push(char::from(byte));
        }
    }
}
