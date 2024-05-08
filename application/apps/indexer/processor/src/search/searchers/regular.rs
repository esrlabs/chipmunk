use crate::{
    map::{FilterMatch, FiltersStats},
    search::{error::SearchError, filter, filter::SearchFilter},
};
use regex::Regex;
use std::{
    collections::HashMap,
    ops::Range,
    path::{Path, PathBuf},
    str::FromStr,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use super::{BaseSearcher, SearchState};

pub type SearchResults = Result<(Range<usize>, Vec<FilterMatch>, FiltersStats), SearchError>;

#[derive(Debug)]
struct Results {
    indexes: Option<Vec<FilterMatch>>,
    stats: Option<FiltersStats>,
}

impl Results {
    pub fn new() -> Self {
        Self {
            indexes: Some(vec![]),
            stats: Some(FiltersStats::default()),
        }
    }
}

#[derive(Debug)]
pub struct RegularSearchState {
    pub file_path: PathBuf,
    pub uuid: Uuid,
    filters: Vec<SearchFilter>,
    matchers: Vec<Regex>,
    aliases: HashMap<usize, String>,
    results: Results,
}

pub type RegularSearchHolder = BaseSearcher<RegularSearchState>;

impl RegularSearchHolder {
    pub fn setup(&mut self, filters: Vec<SearchFilter>) -> Result<(), SearchError> {
        let invalid = filters
            .iter()
            .filter(|&f| !f.valid())
            .map(|f| &f.value)
            .cloned()
            .collect::<Vec<String>>()
            .join("; ");
        if !invalid.is_empty() {
            Err(SearchError::Input(format!("Invalid filters: {invalid}")))?;
        }
        let mut aliases = HashMap::new();
        let mut matchers = vec![];
        for (pos, filter) in filters.iter().enumerate() {
            aliases.insert(pos, filter::as_alias(filter));
            let regex_as_str = filter::as_regex(filter);
            matchers.push(Regex::from_str(&regex_as_str).map_err(|err| {
                SearchError::Regex(format!("Failed to create regex for {regex_as_str}: {err}"))
            })?);
        }
        self.search_state.filters = filters;
        self.search_state.matchers = matchers;
        self.search_state.aliases = aliases;
        Ok(())
    }
}

impl SearchState for RegularSearchState {
    type SearchResultType = SearchResults;
    fn new(path: &Path, uuid: Uuid) -> Self {
        Self {
            file_path: PathBuf::from(path),
            uuid,
            filters: vec![],
            matchers: vec![],
            aliases: HashMap::new(),
            results: Results::new(),
        }
    }
    fn get_terms(&self) -> Vec<String> {
        self.filters.iter().map(filter::as_regex).collect()
    }
}

fn collect(row: u64, line: &str, state: &mut RegularSearchState) {
    let mut line_indexes = FilterMatch::new(row, vec![]);
    let mut matched_rows = vec![];
    for (index, re) in state.matchers.iter().enumerate() {
        if re.is_match(line) {
            matched_rows.push(index as u8);
            line_indexes.filters.push(index as u8);
            if let Some(alias) = state.aliases.get(&index) {
                if let Some(stats) = state.results.stats.as_mut() {
                    stats.inc(alias, None);
                }
            }
        }
    }
    if let Some(indexes) = state.results.indexes.as_mut() {
        indexes.push(line_indexes);
    }
}

pub fn search(
    base_searcher: &mut BaseSearcher<RegularSearchState>,
    rows_count: u64,
    read_bytes: u64,
    cancallation: CancellationToken,
) -> SearchResults {
    base_searcher.search_state.results = Results::new();
    Ok((
        base_searcher.search(rows_count, read_bytes, cancallation, collect)?,
        base_searcher
            .search_state
            .results
            .indexes
            .take()
            .ok_or(SearchError::IoOperation(String::from(
                "Fail to get results: indexes not found",
            )))?,
        base_searcher
            .search_state
            .results
            .stats
            .take()
            .ok_or(SearchError::IoOperation(String::from(
                "Fail to get results: stats not found",
            )))?,
    ))
}
