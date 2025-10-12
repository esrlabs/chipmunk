//! Includes Extractor operations which are used in charts.

use crate::search::{error::SearchError, filter, filter::SearchFilter};
use grep_regex::RegexMatcher;
use grep_searcher::{Searcher, sinks::UTF8};
use itertools::Itertools;
use regex::Regex;
use std::{path::PathBuf, str::FromStr};

fn get_extracted_value(index: u64, input: &str, filters: &[Regex]) -> stypes::ExtractedMatchValue {
    let mut values: Vec<(usize, Vec<String>)> = vec![];
    for (filter_index, filter) in filters.iter().enumerate() {
        for caps in filter.captures_iter(input) {
            // Element on 0 always is the whole match. Here we don't need it
            let matches: Vec<String> = caps
                .iter()
                .flatten()
                .map(|m| m.as_str().to_owned())
                .skip(1)
                .collect();
            if matches.is_empty() {
                warn!("Filter doesn't give matches on matches extracting")
            } else {
                values.push((filter_index, matches));
            }
        }
    }
    stypes::ExtractedMatchValue { index, values }
}
pub struct MatchesExtractor {
    pub file_path: PathBuf,
    filters: Vec<SearchFilter>,
}

impl MatchesExtractor {
    pub fn new(file_path: PathBuf, filters: Vec<SearchFilter>) -> Self {
        Self { file_path, filters }
    }

    pub fn extract_matches(&self) -> Result<Vec<stypes::ExtractedMatchValue>, SearchError> {
        if self.filters.is_empty() {
            return Err(SearchError::Input(
                "Cannot search without filters".to_owned(),
            ));
        }
        let combined_regex: String =
            format!("({})", self.filters.iter().map(filter::as_regex).join("|"));
        let mut values: Vec<stypes::ExtractedMatchValue> = vec![];
        let mut regexs: Vec<Regex> = vec![];
        for filter in self.filters.iter() {
            regexs.push(
                Regex::from_str(&filter::as_regex(filter))
                    .map_err(|err| SearchError::Regex(format!("{err}")))?,
            );
        }
        let regex_matcher = match RegexMatcher::new(&combined_regex) {
            Ok(regex) => regex,
            Err(err) => return Err(SearchError::Regex(format!("{err}"))),
        };
        // Take in account: we are counting on all levels (grabbing search, grabbing stream etc)
        // from 0 line always. But grep gives results from 1. That's why here is a point of correct:
        // lnum - 1
        Searcher::new()
            .search_path(
                &regex_matcher,
                &self.file_path,
                UTF8(|lnum, line| {
                    values.push(get_extracted_value(lnum - 1, line, &regexs));
                    Ok(true)
                }),
            )
            .map_err(|e| {
                SearchError::IoOperation(format!(
                    "Could not search in file {:?}; error: {}",
                    &self.file_path, e
                ))
            })?;

        Ok(values)
    }
}
