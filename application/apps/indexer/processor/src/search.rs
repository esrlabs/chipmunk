use crate::{
    grabber::GrabError,
    map::{FilterMatch, FiltersStats},
};
use buf_redux::{
    do_read,
    policy::{DoRead, ReaderPolicy},
    BufReader as ReduxReader, Buffer,
};
use grep_regex::RegexMatcher;
use grep_searcher::{sinks::UTF8, Searcher};
use itertools::Itertools;
use log::error;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs::File,
    io::{Read, Seek, SeekFrom},
    ops::Range,
    path::{Path, PathBuf},
    str::FromStr,
};
use thiserror::Error;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Debug)]
pub struct CancallableMinBuffered(pub (usize, CancellationToken));

impl CancallableMinBuffered {
    /// Set the number of bytes to ensure are in the buffer.
    pub fn set_min(&mut self, min: usize) {
        self.0 .0 = min;
    }
}

impl ReaderPolicy for CancallableMinBuffered {
    fn before_read(&mut self, buffer: &mut Buffer) -> DoRead {
        // do nothing if we have enough data
        if buffer.len() >= self.0 .0 {
            do_read!(false)
        }

        let cap = buffer.capacity();

        // if there's enough room but some of it's stuck after the head
        if buffer.usable_space() < self.0 .0 && buffer.free_space() >= self.0 .0 {
            buffer.make_room();
        } else if cap < self.0 .0 {
            buffer.reserve(self.0 .0 - cap);
        }

        DoRead(true)
    }

    fn is_paused(&mut self) -> bool {
        self.0 .1.is_cancelled()
    }
}

const REDUX_READER_CAPACITY: usize = 1024 * 1024;
const REDUX_MIN_BUFFER_SPACE: usize = 10 * 1024;

pub type SearchResults = Result<(Range<usize>, Vec<FilterMatch>, FiltersStats), SearchError>;

#[derive(Error, Debug, Serialize)]
pub enum SearchError {
    #[error("Configuration error ({0})")]
    Config(String),
    #[error("Channel-Communication error ({0})")]
    Communication(String),
    #[error("IO error while grabbing: ({0})")]
    IoOperation(String),
    #[error("Regex-Error: ({0})")]
    Regex(String),
    //Regex(#[from] grep_regex::Error),
    #[error("Input-Error: ({0})")]
    Input(String),
    #[error("GrabError error ({0})")]
    Grab(#[from] GrabError),
    #[error("Aborted: ({0})")]
    Aborted(String),
}

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

#[derive(Debug)]
pub struct SearchHolder {
    pub file_path: PathBuf,
    pub uuid: Uuid,
    search_filters: Vec<SearchFilter>,
    bytes_read: u64,
    lines_read: u64,
}

pub struct MatchesExtractor {
    pub file_path: PathBuf,
    filters: Vec<SearchFilter>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SearchFilter {
    pub value: String,
    pub is_regex: bool,
    pub ignore_case: bool,
    pub is_word: bool,
}

use std::borrow::Cow;

#[derive(Serialize, Deserialize, Debug)]
pub struct SearchMatch<'a> {
    #[serde(rename = "n")]
    line: u64,
    #[serde(rename = "c", borrow)]
    content: Cow<'a, str>,
}

impl SearchFilter {
    pub fn new(value: &str) -> Self {
        SearchFilter {
            value: value.to_owned(),
            is_regex: true,
            ignore_case: false,
            is_word: false,
        }
    }

    #[must_use]
    pub fn ignore_case(mut self, ignore: bool) -> Self {
        self.ignore_case = ignore;
        self
    }

    #[must_use]
    pub fn regex(mut self, regex: bool) -> Self {
        self.is_regex = regex;
        self
    }

    #[must_use]
    pub fn word(mut self, word: bool) -> Self {
        self.is_word = word;
        self
    }
}

pub fn get_filter_error(filter: &SearchFilter) -> Option<String> {
    let regex_as_str = filter_as_regex(filter);
    Regex::from_str(&regex_as_str).map_or_else(|err| Some(err.to_string()), |_| None)
}

fn filter_as_regex(filter: &SearchFilter) -> String {
    let word_marker = if filter.is_word { "\\b" } else { "" };
    let ignore_case_start = if filter.ignore_case { "(?i)" } else { "" };
    let ignore_case_end = if filter.ignore_case { "(?-i)" } else { "" };
    let subject = if filter.is_regex {
        filter.value.clone()
    } else {
        regex::escape(&filter.value)
    };
    format!("{ignore_case_start}{word_marker}{subject}{word_marker}{ignore_case_end}",)
}

fn filter_as_alias(filter: &SearchFilter) -> String {
    let word_marker = if filter.is_word { "1" } else { "0" };
    let ignore_case = if filter.ignore_case { "1" } else { "0" };
    let is_regex = if filter.is_regex { "1" } else { "0" };
    format!(
        "{}:{}{}{}",
        filter.value, is_regex, ignore_case, word_marker
    )
}

impl SearchHolder {
    pub fn new<'a, I>(path: &Path, filters: I, uuid: Uuid) -> Self
    where
        I: Iterator<Item = &'a SearchFilter>,
    {
        let mut search_filters = vec![];
        for filter in filters {
            search_filters.push(filter.clone());
        }
        Self {
            file_path: PathBuf::from(path),
            uuid,
            search_filters,
            bytes_read: 0,
            lines_read: 0,
        }
    }

    pub fn set_filters<'a, I>(&mut self, filters: I)
    where
        I: Iterator<Item = &'a SearchFilter>,
    {
        self.search_filters = vec![];
        for filter in filters {
            self.search_filters.push(filter.clone());
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
    pub fn execute_search(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancallation: CancellationToken,
    ) -> SearchResults {
        if read_bytes == 0 || read_bytes == self.bytes_read {
            return Ok((0..0, vec![], FiltersStats::default()));
        }
        if read_bytes < self.bytes_read {
            return Err(SearchError::IoOperation(format!(
                "Invalid amount of read bytes ({read_bytes}). Processed bytes {}",
                self.bytes_read
            )));
        }
        if self.search_filters.is_empty() {
            return Err(SearchError::Input(
                "Cannot search without filters".to_owned(),
            ));
        }
        let combined_regex: String = format!(
            "({})",
            self.search_filters.iter().map(filter_as_regex).join("|")
        );
        let matcher = match RegexMatcher::new(&combined_regex) {
            Ok(regex) => regex,
            Err(err) => {
                return Err(SearchError::Regex(format!(
                    "Fail to create combined regex for {combined_regex}: {err}"
                )))
            }
        };
        let mut matchers: Vec<Regex> = vec![];
        let mut aliases: HashMap<usize, String> = HashMap::new();
        for (pos, filter) in self.search_filters.iter().enumerate() {
            aliases.insert(pos, filter_as_alias(filter));
            let regex_as_str = filter_as_regex(filter);
            matchers.push(Regex::from_str(&regex_as_str).map_err(|err| {
                SearchError::Regex(format!("Fail to create regex for {regex_as_str}: {err}"))
            })?);
        }
        let in_file = File::open(&self.file_path).map_err(|_| {
            GrabError::IoOperation(format!("Could not open file {:?}", &self.file_path))
        })?;
        let mut in_file_reader =
            ReduxReader::with_capacity(REDUX_READER_CAPACITY, in_file).set_policy(
                CancallableMinBuffered((REDUX_MIN_BUFFER_SPACE, cancallation)),
            );
        in_file_reader
            .seek(SeekFrom::Start(self.bytes_read))
            .map_err(|_| {
                GrabError::IoOperation(format!(
                    "Could not seek file {:?} to {}",
                    &self.file_path, self.bytes_read
                ))
            })?;
        let mut reader_handler = in_file_reader.take(read_bytes - self.bytes_read);
        let mut indexes: Vec<FilterMatch> = vec![];
        let mut stats = FiltersStats::default();
        // Take in account: we are counting on all levels (grabbing search, grabbing stream etc)
        // from 0 line always. But grep gives results from 1. That's why here is a point of correct:
        // lnum - 1
        let lines_read = self.lines_read;
        self.lines_read = rows_count;
        Searcher::new()
            .search_reader(
                &matcher,
                &mut reader_handler,
                UTF8(|lnum, line| {
                    let lnum = lnum + lines_read;
                    let mut line_indexes = FilterMatch::new(lnum - 1, vec![]);
                    for (index, re) in matchers.iter().enumerate() {
                        if re.is_match(line) {
                            line_indexes.filters.push(index as u8);
                            if let Some(alias) = aliases.get(&index) {
                                stats.inc(alias, None);
                            }
                        }
                    }
                    indexes.push(line_indexes);
                    Ok(true)
                }),
            )
            .map_err(|e| {
                SearchError::IoOperation(format!(
                    "Could not search in file {:?}; error: {e}",
                    &self.file_path
                ))
            })?;
        self.bytes_read = read_bytes + 1;
        let processed = lines_read as usize..(lines_read as usize + indexes.len());
        Ok((processed, indexes, stats))
    }
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
            format!("({})", self.filters.iter().map(filter_as_regex).join("|"));
        let mut values: Vec<ExtractedMatchValue> = vec![];
        let mut regexs: Vec<Regex> = vec![];
        for filter in self.filters.iter() {
            regexs.push(
                Regex::from_str(&filter_as_regex(filter))
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

#[cfg(test)]
mod tests {
    const LOGS: &[&str] = &[
        "[Info](1.3): a",
        "[Warn](1.4): b",
        "[Info](1.5): c",
        "[Err](1.6): d",
        "[Info](1.7): e",
        "[Info](1.8): f",
    ];
    use super::*;
    use std::io::{Error, ErrorKind, Write};

    // create tmp file with content, apply search
    fn filtered(
        content: &str,
        filters: &[SearchFilter],
    ) -> Result<Vec<FilterMatch>, std::io::Error> {
        let mut tmp_file = tempfile::NamedTempFile::new()?;
        let input_file = tmp_file.as_file_mut();
        input_file.write_all(content.as_bytes())?;
        let file_size = input_file.metadata()?.len();
        let mut holder = SearchHolder::new(tmp_file.path(), filters.iter(), Uuid::new_v4());
        let (_range, indexes, _stats) = holder
            .execute_search(0, file_size, CancellationToken::new())
            .map_err(|e| Error::new(ErrorKind::Other, format!("Error in search: {e}")))?;
        Ok(indexes)
    }

    #[test]
    fn test_ripgrep_regex_non_regex() -> Result<(), std::io::Error> {
        let filters = vec![
            SearchFilter::new(r"[Err]")
                .regex(false)
                .ignore_case(true)
                .word(false),
            SearchFilter::new(r"\[Warn\]")
                .regex(true)
                .ignore_case(true)
                .word(false),
        ];

        let matches = filtered(&LOGS.join("\n"), &filters)?;
        println!("matches: {matches:?}");
        assert_eq!(2, matches.len());
        assert_eq!(1, matches[0].index);
        assert_eq!(3, matches[1].index);
        Ok(())
    }

    #[test]
    fn test_ripgrep_case_sensitivity() -> Result<(), std::io::Error> {
        let filters = vec![
            SearchFilter::new(r"[err]")
                .regex(false)
                .ignore_case(true)
                .word(false),
            SearchFilter::new(r"[warn]")
                .regex(false)
                .ignore_case(false)
                .word(false),
        ];

        let matches = filtered(&LOGS.join("\n"), &filters)?;
        println!("matches: {matches:?}");
        assert_eq!(1, matches.len());
        assert_eq!(3, matches[0].index);
        Ok(())
    }
}
