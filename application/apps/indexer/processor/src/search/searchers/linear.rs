use crate::search::{error::SearchError, filter, filter::SearchFilter};
use regex::Regex;
use std::str::FromStr;

/// Represents a utility for searching matches in a string.
/// Primarily used for nested searches, such as filtering results from a primary search.
#[derive(Debug)]
pub struct LineSearcher {
    /// A compiled regular expression used for matching lines.
    re: Regex,
    /// invert the match result.
    invert: bool,
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
            invert: filter.invert,
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
        let do_match = self.re.is_match(ln);
        if self.invert { !do_match } else { do_match }
    }
}
