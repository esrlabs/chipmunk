use crate::search::{error::SearchError, filter, filter::SearchFilter};
use regex::Regex;
use std::str::FromStr;

#[derive(Debug)]
pub struct LineSearcher {
    re: Regex,
}

impl LineSearcher {
    pub fn new(filter: &SearchFilter) -> Result<Self, SearchError> {
        let regex_as_str = filter::as_regex(filter);
        Ok(Self {
            re: Regex::from_str(&regex_as_str).map_err(|err| {
                SearchError::Regex(format!("Failed to create regex for {regex_as_str}: {err}"))
            })?,
        })
    }

    pub fn is_match(&self, ln: &str) -> bool {
        self.re.is_match(ln)
    }
}
