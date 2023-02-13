use crate::search::error::SearchError;
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

pub type OperationResults = Result<(Range<usize>, HashMap<u64, Vec<(u8, String)>>), SearchError>;

#[derive(Debug)]
struct Results {
    indexes: Option<HashMap<u64, Vec<(u8, String)>>>,
}

impl Results {
    pub fn new() -> Self {
        Self {
            indexes: Some(HashMap::new()),
        }
    }
}

#[derive(Debug)]
pub struct ValueSearchState {
    pub file_path: PathBuf,
    pub uuid: Uuid,
    filters: Vec<String>,
    matchers: Vec<Regex>,
    results: Results,
}

pub type ValueSearchHolder = BaseSearcher<ValueSearchState>;

impl ValueSearchHolder {
    pub fn set_filters(&mut self, filters: Vec<String>) -> Result<(), SearchError> {
        let mut matchers = vec![];
        for (_pos, filter) in filters.iter().enumerate() {
            matchers.push(Regex::from_str(filter).map_err(|err| {
                SearchError::Regex(format!("Failed to create regex for {filter}: {err}"))
            })?);
        }
        self.search_state.filters = filters;
        self.search_state.matchers = matchers;
        Ok(())
    }
}

impl SearchState for ValueSearchState {
    type SearchResultType = OperationResults;
    fn new(path: &Path, uuid: Uuid) -> Self {
        Self {
            file_path: PathBuf::from(path),
            uuid,
            filters: vec![],
            matchers: vec![],
            results: Results::new(),
        }
    }
    fn get_terms(&self) -> Vec<String> {
        self.filters.clone()
    }
}

fn collect(row: u64, line: &str, state: &mut ValueSearchState) {
    let mut matches = vec![];
    for (index, re) in state.matchers.iter().enumerate() {
        if let Some(caps) = re.captures(line) {
            if let Some(value) = caps.get(1) {
                matches.push((index as u8, value.as_str().to_owned()));
            }
        }
    }
    if let Some(indexes) = state.results.indexes.as_mut() {
        indexes.insert(row, matches);
    }
}

pub fn execute_fresh_value_search(
    base_searcher: &mut BaseSearcher<ValueSearchState>,
    filters: Vec<String>,
    rows_count: u64,
    read_bytes: u64,
    cancallation: CancellationToken,
) -> OperationResults {
    base_searcher.search_state.results = Results::new();
    base_searcher.set_filters(filters)?;
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
    ))
}

pub fn continue_value_search(
    base_searcher: &mut BaseSearcher<ValueSearchState>,
    rows_count: u64,
    read_bytes: u64,
    cancallation: CancellationToken,
) -> OperationResults {
    // TODO @dmitry: is it correct to reset the search results?
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
    ))
}
