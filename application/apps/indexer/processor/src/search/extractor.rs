use crate::search::{error::SearchError, filter, filter::SearchFilter};
use grep_regex::RegexMatcher;
use grep_searcher::{SearcherBuilder, sinks::UTF8};
use itertools::{Either, Itertools};
use regex::Regex;
use std::{
    path::{Path, PathBuf},
    str::FromStr,
};

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

    pub fn extract_matches(&self) -> Result<Vec<stypes::ExtractedMatchValue>, SearchError> {
        if self.filters.is_empty() {
            return Err(SearchError::Input(
                "Cannot search without filters".to_owned(),
            ));
        }

        let (include_regexs, exclude_regexs): (Vec<_>, Vec<_>) =
            self.filters.iter().partition_map(|f| {
                let as_regex = filter::as_regex(f);
                if f.invert {
                    Either::Right(as_regex)
                } else {
                    Either::Left(as_regex)
                }
            });

        let mut values: Vec<stypes::ExtractedMatchValue> = vec![];

        for (idx, patterns) in [include_regexs, exclude_regexs].into_iter().enumerate() {
            if patterns.is_empty() {
                continue;
            }
            let invert = idx == 1;
            let regexs: Vec<_> = patterns
                .iter()
                .map(|as_regex| {
                    Regex::from_str(as_regex).map_err(|err| SearchError::Regex(format!("{err}")))
                })
                .try_collect()?;

            let combined = format!("({})", patterns.join("|"));

            let regex_matcher = match RegexMatcher::new(&combined) {
                Ok(regex) => regex,
                Err(err) => return Err(SearchError::Regex(format!("{err}"))),
            };

            SearcherBuilder::new()
                .invert_match(invert)
                .build()
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
        }

        Ok(values)
    }
}
