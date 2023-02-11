use crate::{
    map::{FilterMatch, FiltersStats},
    search::{error::SearchError, filter, filter::SearchFilter, searchers::Base},
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

use super::BaseSearcher;

pub type SearchResults = Result<(Range<usize>, Vec<FilterMatch>, FiltersStats), SearchError>;

#[derive(Debug)]
struct Results {
    indexes: Option<Vec<FilterMatch>>,
    matchers: Vec<Regex>,
    aliases: HashMap<usize, String>,
    stats: Option<FiltersStats>,
}

impl Results {
    pub fn new(filters: Option<&[SearchFilter]>) -> Result<Self, SearchError> {
        let mut aliases = HashMap::new();
        let mut matchers = vec![];
        if let Some(filters) = filters {
            for (pos, filter) in filters.iter().enumerate() {
                aliases.insert(pos, filter::as_alias(filter));
                let regex_as_str = filter::as_regex(filter);
                matchers.push(Regex::from_str(&regex_as_str).map_err(|err| {
                    SearchError::Regex(format!("Failed to create regex for {regex_as_str}: {err}"))
                })?);
            }
        }
        Ok(Self {
            indexes: Some(vec![]),
            matchers,
            aliases,
            stats: Some(FiltersStats::default()),
        })
    }
}

#[derive(Debug)]
pub struct Searcher {
    pub file_path: PathBuf,
    pub uuid: Uuid,
    filters: Vec<SearchFilter>,
    bytes_read: u64,
    lines_read: u64,
    results: Results,
}

impl Searcher {
    pub fn new(path: &Path, filters: Vec<SearchFilter>, uuid: Uuid) -> Self {
        Self {
            file_path: PathBuf::from(path),
            uuid,
            filters,
            bytes_read: 0,
            lines_read: 0,
            // It's safetly because we do not provide any data inside
            results: Results::new(None).unwrap(),
        }
    }

    pub fn set_filters<'a, I>(&mut self, filters: I)
    where
        I: Iterator<Item = &'a SearchFilter>,
    {
        self.filters = vec![];
        for filter in filters {
            self.filters.push(filter.clone());
        }
    }

    /// execute a search for the given input path and filters
    /// return the file that contains the search results along with the
    /// map of found matches. Format of map is an array of matches:
    /// [
    ///     (index in stream, [index of matching filter]),
    ///     ...
    ///     (index in stream, [index of matching filter]),
    /// ]
    ///
    /// stat information shows how many times a filter matched:
    /// [(index_of_filter, count_of_matches), ...]
    pub fn _execute(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancallation: CancellationToken,
    ) -> SearchResults {
        self.results = Results::new(Some(&self.filters))?;
        let processed = self.search(rows_count, read_bytes, cancallation)?;
        Ok((
            processed,
            self.results
                .indexes
                .take()
                .ok_or(SearchError::IoOperation(String::from(
                    "Fail to get results: indexes not found",
                )))?,
            self.results
                .stats
                .take()
                .ok_or(SearchError::IoOperation(String::from(
                    "Fail to get results: stats not found",
                )))?,
        ))
    }
}

impl Base for Searcher {
    fn get_file_path(&self) -> &PathBuf {
        &self.file_path
    }
    fn get_bytes_read(&self) -> u64 {
        self.bytes_read
    }
    fn set_bytes_read(&mut self, bytes: u64) {
        self.bytes_read = bytes;
    }
    fn get_lines_read(&self) -> u64 {
        self.lines_read
    }
    fn set_lines_read(&mut self, lines: u64) {
        self.lines_read = lines;
    }
    fn get_terms(&self) -> Vec<String> {
        self.filters.iter().map(filter::as_regex).collect()
    }

    fn matching(&mut self, row: u64, line: &str) {
        let mut line_indexes = FilterMatch::new(row, vec![]);
        let mut matched_rows = vec![];
        for (index, re) in self.results.matchers.iter().enumerate() {
            if re.is_match(line) {
                matched_rows.push(index as u8);
                // line_indexes.filters.push(index as u8);
                if let Some(alias) = self.results.aliases.get(&index) {
                    if let Some(stats) = self.results.stats.as_mut() {
                        stats.inc(alias, None);
                    }
                }
            }
        }
        if let Some(indexes) = self.results.indexes.as_mut() {
            indexes.push(line_indexes);
        }
    }
}

pub struct RegularSearchState {
    pub file_path: PathBuf,
    pub uuid: Uuid,
    // filters: Vec<SearchFilter>,
    // bytes_read: u64,
    // lines_read: u64,
    results: Results,
}
impl RegularSearchState {
    pub fn new(path: &Path, filters: Vec<SearchFilter>, uuid: Uuid) -> Self {
        Self {
            file_path: PathBuf::from(path),
            uuid,
            // filters,
            // bytes_read: 0,
            // lines_read: 0,
            // It's safetly because we do not provide any data inside
            results: Results::new(None).unwrap(),
        }
    }
}
fn collect(row: u64, line: &str, state: &mut RegularSearchState) -> Result<bool, std::io::Error> {
    let mut line_indexes = FilterMatch::new(row, vec![]);
    let mut matched_rows = vec![];
    for (index, re) in state.results.matchers.iter().enumerate() {
        if re.is_match(line) {
            matched_rows.push(index as u8);
            line_indexes.filters.push(index as u8);
            if let Some(alias) = state.results.aliases.get(&index) {
                if let Some(stats) = state.results.stats.as_mut() {
                    stats.inc(alias, None);
                }
            }
        }
    }
    if let Some(indexes) = state.results.indexes.as_mut() {
        indexes.push(line_indexes);
    }
    Ok(true)
}
pub fn regulare_search(
    path: &Path,
    filters: Vec<SearchFilter>,
    uuid: Uuid,
    rows_count: u64,
    read_bytes: u64,
    cancallation: CancellationToken,
) -> SearchResults {
    let terms = filters.iter().map(filter::as_regex).collect();
    let mut search_state = RegularSearchState::new(path, filters, uuid);
    let mut base_searcher = BaseSearcher {
        file_path: PathBuf::from(path),
        uuid,
        bytes_read: 0,
        lines_read: 0,
    };
    let processed = base_searcher.search(
        rows_count,
        read_bytes,
        cancallation,
        terms,
        &mut search_state,
        collect,
    )?;
    Ok((
        processed,
        search_state
            .results
            .indexes
            .take()
            .ok_or(SearchError::IoOperation(String::from(
                "Fail to get results: indexes not found",
            )))?,
        search_state
            .results
            .stats
            .take()
            .ok_or(SearchError::IoOperation(String::from(
                "Fail to get results: stats not found",
            )))?,
    ))
}
