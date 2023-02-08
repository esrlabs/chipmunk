use crate::search::{error::SearchError, searchers::Base};
use regex::Regex;
use std::{
    ops::Range,
    path::{Path, PathBuf},
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub type OperationResults = Result<(Range<usize>, Vec<Matches>), SearchError>;

/// Lists all matching filters at an index
#[derive(Debug, Clone)]
pub struct Matches {
    pub index: u64,
    pub values: Vec<(u8, String)>,
}

impl Matches {
    pub fn new(index: u64, values: Vec<(u8, String)>) -> Self {
        Self { index, values }
    }
}

#[derive(Debug)]
struct Results {
    indexes: Option<Vec<Matches>>,
    matchers: Vec<Regex>,
}

impl Results {
    pub fn new() -> Self {
        Self {
            indexes: Some(vec![]),
            matchers: vec![],
        }
    }
}

#[derive(Debug)]
pub struct Searcher {
    pub file_path: PathBuf,
    pub uuid: Uuid,
    filters: Vec<String>,
    bytes_read: u64,
    lines_read: u64,
    results: Results,
}

impl Searcher {
    pub fn new(path: &Path, filters: Vec<String>, uuid: Uuid) -> Self {
        Self {
            file_path: PathBuf::from(path),
            uuid,
            filters,
            bytes_read: 0,
            lines_read: 0,
            results: Results::new(),
        }
    }

    pub fn set_filters(&mut self, filters: Vec<String>) {
        self.filters = filters;
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
    pub fn execute(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancallation: CancellationToken,
    ) -> OperationResults {
        self.results = Results::new();
        let processed = self.search(rows_count, read_bytes, cancallation)?;
        Ok((
            processed,
            self.results
                .indexes
                .take()
                .ok_or(SearchError::IoOperation(String::from(
                    "Fail to get results: indexes not found",
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
        self.filters.clone()
    }

    fn matching(&mut self, row: u64, line: &str) {
        let mut matches = Matches::new(row - 1, vec![]);
        for (index, re) in self.results.matchers.iter().enumerate() {
            if let Some(caps) = re.captures(line) {
                if let Some(value) = caps.get(1) {
                    matches
                        .values
                        .push((index as u8, value.as_str().to_owned()));
                }
            }
        }
        if let Some(indexes) = self.results.indexes.as_mut() {
            indexes.push(matches);
        }
    }
}
