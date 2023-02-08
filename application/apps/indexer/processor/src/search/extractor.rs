use crate::search::{error::SearchError, filter, filter::SearchFilter};
use grep_regex::RegexMatcher;
use grep_searcher::{sinks::UTF8, Searcher};
use itertools::Itertools;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    str::FromStr,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedMatchValue {
    pub index: u64,
    /// (filter index, extracted value)
    pub values: Vec<(usize, Vec<String>)>,
}

impl ExtractedMatchValue {
    pub fn new(index: u64, input: &str, filters: &[Regex]) -> Self {
        Self {
            index,
            values: ExtractedMatchValue::extract(input, filters),
        }
    }

    pub fn extract(input: &str, filters: &[Regex]) -> Vec<(usize, Vec<String>)> {
        let mut values: Vec<(usize, Vec<String>)> = vec![];
        for (filter_index, filter) in filters.iter().enumerate() {
            for caps in filter.captures_iter(input) {
                let mut matches: Vec<String> = caps
                    .iter()
                    .flatten()
                    .map(|m| m.as_str().to_owned())
                    .collect();
                if matches.len() <= 1 {
                    // warn here
                } else {
                    // 0 always - whole match
                    matches.remove(0);
                    values.push((filter_index, matches));
                }
            }
        }
        values
    }
}

pub struct MatchesExtractor {
    pub file_path: PathBuf,
    filters: Vec<SearchFilter>,
}

impl MatchesExtractor {
    pub fn new<'a, I>(path: &Path, filters: I) -> Self
    where
        I: Iterator<Item = &'a SearchFilter>,
    {
        let mut search_filters = vec![];
        for filter in filters {
            search_filters.push(filter.clone());
        }
        Self {
            file_path: PathBuf::from(path),
            filters: search_filters,
        }
    }

    /// TODO: add description
    pub fn extract_matches(&self) -> Result<Vec<ExtractedMatchValue>, SearchError> {
        if self.filters.is_empty() {
            return Err(SearchError::Input(
                "Cannot search without filters".to_owned(),
            ));
        }
        let combined_regex: String =
            format!("({})", self.filters.iter().map(filter::as_regex).join("|"));
        let mut values: Vec<ExtractedMatchValue> = vec![];
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
                    values.push(ExtractedMatchValue::new(lnum - 1, line, &regexs));
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
