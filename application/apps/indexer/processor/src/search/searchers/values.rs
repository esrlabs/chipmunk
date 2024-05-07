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

pub type OperationResults = Result<(Range<usize>, HashMap<u8, Vec<(u64, f64)>>), SearchError>;

#[derive(Debug)]
struct Results {
    indexes: Option<HashMap<u8, Vec<(u64, f64)>>>,
}

impl Results {
    pub fn new() -> Self {
        Self {
            indexes: Some(HashMap::new()),
        }
    }
}

pub fn as_regex(filter: &str) -> String {
    format!("(?i){filter}(?-i)")
}

/// Validate search condition. Checks possibility to convert
/// given string into RegEx
///
/// # Arguments
///
/// * `filter` - Regular expression as a string
///
/// # Returns
///
/// `true` in case of valid condition; `false` - invalid
///
fn is_valid(filter: &str) -> bool {
    Regex::from_str(&as_regex(filter)).is_ok()
}

#[derive(Debug)]
pub struct ValueSearchState {
    pub file_path: PathBuf,
    pub uuid: Uuid,
    terms: Vec<String>,
    matchers: Vec<Regex>,
    results: Results,
    errors: HashMap<u64, Vec<(u8, String)>>,
}

pub type ValueSearchHolder = BaseSearcher<ValueSearchState>;

impl ValueSearchHolder {
    pub fn setup(&mut self, terms: Vec<String>) -> Result<(), SearchError> {
        let invalid = terms
            .iter()
            .filter(|f| !is_valid(f))
            .cloned()
            .collect::<Vec<String>>()
            .join("; ");
        if !invalid.is_empty() {
            Err(SearchError::Input(format!("Invalid filters: {invalid}")))?;
        }
        let mut matchers = vec![];
        for filter in terms.iter() {
            matchers.push(Regex::from_str(&as_regex(filter)).map_err(|err| {
                SearchError::Regex(format!("Failed to create regex for {filter}: {err}"))
            })?);
        }
        self.search_state.terms = terms;
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
            terms: vec![],
            matchers: vec![],
            results: Results::new(),
            errors: HashMap::new(),
        }
    }
    fn get_terms(&self) -> Vec<String> {
        self.terms.iter().map(|f| as_regex(f)).collect()
    }
}

fn collect(row: u64, line: &str, state: &mut ValueSearchState) {
    for (term_index, re) in state.matchers.iter().enumerate() {
        if let Some(caps) = re.captures(line) {
            if let Some(value) = caps.get(1) {
                let value_str = value.as_str().to_owned();
                if let Ok(value_i64) = value_str.parse::<f64>() {
                    if let Some(indexes) = state.results.indexes.as_mut() {
                        if let Some(matches) = indexes.get_mut(&(term_index as u8)) {
                            matches.push((row, value_i64));
                        } else {
                            indexes.insert(term_index as u8, vec![(row, value_i64)]);
                        }
                    }
                } else if let Some(errors) = state.errors.get_mut(&row) {
                    errors.push((term_index as u8, value_str));
                } else {
                    state
                        .errors
                        .insert(row, vec![(term_index as u8, value_str)]);
                }
            }
        }
    }
}

pub fn search(
    base_searcher: &mut BaseSearcher<ValueSearchState>,
    rows_count: u64,
    read_bytes: u64,
    cancallation: CancellationToken,
) -> OperationResults {
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
