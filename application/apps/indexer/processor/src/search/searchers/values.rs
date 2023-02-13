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
    matchers: Vec<Regex>,
}

impl Results {
    pub fn new(filters: Option<&[String]>) -> Result<Self, SearchError> {
        let mut matchers = vec![];
        if let Some(filters) = filters {
            for (_pos, filter) in filters.iter().enumerate() {
                matchers.push(Regex::from_str(filter).map_err(|err| {
                    SearchError::Regex(format!("Failed to create regex for {filter}: {err}"))
                })?);
            }
        }
        Ok(Self {
            indexes: Some(HashMap::new()),
            matchers,
        })
    }
}

#[derive(Debug)]
pub struct ValueSearchState {
    pub file_path: PathBuf,
    pub uuid: Uuid,
    filters: Vec<String>,
    results: Results,
}

pub type ValueSearchHolder = BaseSearcher<ValueSearchState>;

impl ValueSearchHolder {
    pub fn set_filters(&mut self, filters: Vec<String>) {
        self.search_state.filters = filters;
    }
}

impl SearchState for ValueSearchState {
    type SearchResultType = OperationResults;
    fn new(path: &Path, uuid: Uuid) -> Self {
        Self {
            file_path: PathBuf::from(path),
            uuid,
            filters: vec![],
            results: Results::new(None).unwrap(),
        }
    }
    fn get_terms(&self) -> Vec<String> {
        self.filters.clone()
    }
}

fn collect(row: u64, line: &str, state: &mut ValueSearchState) {
    let mut matches = vec![];
    for (index, re) in state.results.matchers.iter().enumerate() {
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

pub fn execute_search(
    base_searcher: &mut BaseSearcher<ValueSearchState>,
    rows_count: u64,
    read_bytes: u64,
    cancallation: CancellationToken,
) -> OperationResults {
    base_searcher.search_state.results = Results::new(Some(&base_searcher.search_state.filters))?;
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
pub fn value_search(
    path: &Path,
    uuid: Uuid,
    rows_count: u64,
    read_bytes: u64,
    cancallation: CancellationToken,
) -> OperationResults {
    let mut base_searcher = BaseSearcher::new(path, uuid, 0, 0);
    execute_search(&mut base_searcher, rows_count, read_bytes, cancallation)
}
