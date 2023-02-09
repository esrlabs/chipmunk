use crate::search::{error::SearchError, filter, searchers::Base};
use regex::Regex;
use std::{
    collections::HashMap,
    ops::Range,
    path::{Path, PathBuf},
    str::FromStr,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

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
            for (pos, filter) in filters.iter().enumerate() {
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
            // It's safetly because we do not provide any data inside
            results: Results::new(None).unwrap(),
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
        let mut matches = vec![];
        for (index, re) in self.results.matchers.iter().enumerate() {
            if let Some(caps) = re.captures(line) {
                if let Some(value) = caps.get(1) {
                    matches.push((index as u8, value.as_str().to_owned()));
                }
            }
        }
        if let Some(indexes) = self.results.indexes.as_mut() {
            indexes.insert(row, matches);
        }
    }
}
