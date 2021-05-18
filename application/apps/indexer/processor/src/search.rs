use crate::map::FilterMatch;
use grep_printer::{SummaryBuilder, SummaryKind};
use grep_regex::{RegexMatcher, RegexMatcherBuilder};
use grep_searcher::{
    sinks::{Bytes, UTF8},
    Searcher, Sink, SinkMatch,
};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs::File,
    io::{BufWriter, Write},
    path::{Path, PathBuf},
};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SearchError {
    #[error("Configuration error ({0})")]
    Config(String),
    #[error("Channel-Communication error ({0})")]
    Communication(String),
    #[error("IO error while grabbing: ({0})")]
    IoOperation(#[from] std::io::Error),
    #[error("Regex-Error: ({0})")]
    Regex(#[from] grep_regex::Error),
    #[error("Input-Error: ({0})")]
    Input(String),
}

pub struct SearchHolder {
    pub file_path: PathBuf,
    pub out_file_path: PathBuf,
    search_filters: Vec<SearchFilter>,
    // pub handler: Option<EventHandler>,
    // pub shutdown_channel: Channel<()>,
    // pub event_channel: Channel<IndexingResults<()>>
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

    pub fn ignore_case(mut self, ignore: bool) -> Self {
        self.ignore_case = ignore;
        self
    }

    pub fn regex(mut self, regex: bool) -> Self {
        self.is_regex = regex;
        self
    }

    pub fn word(mut self, word: bool) -> Self {
        self.is_word = word;
        self
    }
}

fn escape(value: &str) -> String {
    let mapping: HashMap<char, String> = "{}[]+$^/!.*|():?,=<>\\"
        .chars()
        .map(|c| (c, format!("\\{}", c)))
        .collect();
    value
        .chars()
        .map(|c| match mapping.get(&c) {
            Some(v) => v.clone(),
            None => format!("{}", c),
        })
        .collect::<String>()
}

fn filter_as_regex(filter: &SearchFilter) -> String {
    let word_marker = if filter.is_word { "\\b" } else { "" };
    let ignore_case_start = if filter.ignore_case { "(?i)" } else { "" };
    let ignore_case_end = if filter.ignore_case { "(?-i)" } else { "" };
    let subject = if filter.is_regex {
        filter.value.clone()
    } else {
        escape(&filter.value)
    };
    format!(
        "{}{}{}{}{}",
        ignore_case_start, word_marker, subject, word_marker, ignore_case_end,
    )
}

impl SearchHolder {
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
            out_file_path: PathBuf::from(format!("{}.out", path.to_string_lossy())),
            search_filters,
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
        &self,
    ) -> Result<(PathBuf, Vec<FilterMatch>, Vec<(u8, u64)>), SearchError> {
        use regex::Regex;
        use std::str::FromStr;

        if self.search_filters.is_empty() {
            return Err(SearchError::Input(
                "Cannot search without filters".to_owned(),
            ));
        }
        let regex: String = format!(
            "({})",
            self.search_filters
                .iter()
                .map(|f: &SearchFilter| filter_as_regex(&f))
                .join("|")
        );
        let matcher = RegexMatcher::new(&regex)?;
        let mut matchers: Vec<Regex> = vec![];
        for filter in self.search_filters.iter() {
            if let Ok(r) = Regex::from_str(&filter.value.clone()) {
                matchers.push(r);
            }
        }
        let out_file = File::create(&self.out_file_path)?;
        let mut matched_lines = 0u64;
        let mut writer = BufWriter::new(out_file);
        let mut indexes: Vec<FilterMatch> = vec![];
        let mut stats: HashMap<u8, u64> = HashMap::new();
        Searcher::new().search_path(
            &matcher,
            &self.file_path,
            UTF8(|lnum, line| {
                matched_lines += 1;
                let mut line_indexes = FilterMatch::new(lnum, vec![]);
                for (index, re) in matchers.iter().enumerate() {
                    if re.is_match(line) {
                        line_indexes.filters.push(index as u8);
                        *stats.entry(index as u8).or_insert(0) += 1;
                    }
                }
                indexes.push(line_indexes);
                writeln!(writer, "{}", lnum)?;
                Ok(true)
            }),
        )?;

        Ok((
            self.out_file_path.clone(),
            indexes,
            stats
                .into_iter()
                .map(|(filter_index, meets)| (filter_index, meets))
                .collect(),
        ))
    }
}

struct MySink {
    matches: u64,
}
impl Sink for MySink {
    type Error = std::io::Error;

    fn matched(&mut self, _searcher: &Searcher, _mat: &SinkMatch) -> Result<bool, Self::Error> {
        self.matches += 1;
        println!(
            "MySink matched called {} times (mat = {:?})",
            self.matches, _mat
        );
        Ok(true)
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
    // use grep_printer::SummaryBuilder;
    use std::io::{Error, ErrorKind};
    fn as_matches(content: &str) -> Vec<SearchMatch> {
        let lines: Vec<&str> = content.lines().collect();
        println!("lines: {:?}", lines);
        lines
            .into_iter()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }

    // create tmp file with content, apply search
    fn filtered(content: &str, filters: &[SearchFilter]) -> Result<String, std::io::Error> {
        let mut tmp_file = tempfile::NamedTempFile::new()?;
        let input_file = tmp_file.as_file_mut();
        input_file.write_all(content.as_bytes())?;
        let search_holder = SearchHolder::new(tmp_file.path(), filters.iter());
        let (out_path, _indexes, _stats) = search_holder
            .execute_search()
            .map_err(|e| Error::new(ErrorKind::Other, format!("Error in search: {}", e)))?;
        std::fs::read_to_string(out_path)
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

        let result_content = filtered(&LOGS.join("\n"), &filters)?;
        println!("result_content: {:?}", result_content);
        let matches = as_matches(&result_content);
        assert_eq!(2, matches.len());
        assert_eq!(2, matches[0].line);
        assert_eq!("[Warn](1.4): b", matches[0].content);
        assert_eq!(4, matches[1].line);
        assert_eq!("[Err](1.6): d", matches[1].content);
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

        let result_content = filtered(&LOGS.join("\n"), &filters)?;
        println!("result_content: {:?}", result_content);
        let matches = as_matches(&result_content);
        assert_eq!(1, matches.len());
        assert_eq!(4, matches[0].line);
        assert_eq!("[Err](1.6): d", matches[0].content);
        Ok(())
    }
}
