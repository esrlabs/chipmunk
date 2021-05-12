// use grep::regex::{
//     RegexMatcher as RustRegexMatcher, RegexMatcherBuilder as RustRegexMatcherBuilder,
// };
use grep_printer::{SummaryBuilder, SummaryKind};
use grep_regex::RegexMatcherBuilder;
use grep_searcher::{Sink, SinkMatch};
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

use grep_regex::RegexMatcher;
use grep_searcher::{
    sinks::{Bytes, UTF8},
    Searcher,
};

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
    ///     (position in stream, [index of matching filter]),
    ///     ...
    ///     (position in stream, [index of matching filter]),
    /// ]
    pub fn execute_search(
        &self,
    ) -> Result<(PathBuf, Vec<(u64, Vec<u8>)>, Vec<(u8, u64)>), SearchError> {
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
        let mut indexes: Vec<(u64, Vec<u8>)> = vec![];
        let mut stats: HashMap<u8, u64> = HashMap::new();
        Searcher::new().search_path(
            &matcher,
            &self.file_path,
            UTF8(|lnum, line| {
                matched_lines += 1;
                let mut line_indexes: (u64, Vec<u8>) = (lnum, vec![]);
                for (index, re) in matchers.iter().enumerate() {
                    if re.is_match(line) {
                        line_indexes.1.push(index as u8);
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

pub fn execute_binary_search_of_slice(slice: &[u8], pattern: &str) -> Result<u64, SearchError> {
    // let mut matched_lines = 0u64;

    let mut builder = RegexMatcherBuilder::new();
    builder
        .case_smart(false)
        .case_insensitive(false)
        .multi_line(true)
        .unicode(true)
        .octal(false)
        .word(false);
    let matcher = builder.build(pattern)?;

    let sink = MySink { matches: 0 };
    // let matcher = RegexMatcher::new(pattern)?;
    Searcher::new().search_slice(
        &matcher,
        slice,
        sink
        // UTF8(|lnum, line| {
        //     matched_lines += 1;
        //     let line_match = SearchMatch {
        //         line: lnum,
        //         content: Cow::Borrowed(line.trim_end()),
        //     };
        //     if let Ok(content) = serde_json::to_string(&line_match) {
        //         writeln!(writer, "{}", content)?;
        //     } else {
        //         log::error!("Could not serialize {:?}", line_match);
        //     }
        //     Ok(true)
        // }),
    )?;

    Ok(999)
}

pub fn count_pattern_in_binary(pattern: &str, input_file: &Path) -> Result<u64, std::io::Error> {
    // execute_binary_search_of_slice(&DLT_LOGS, &pattern)
    //     .map_err(|e| Error::new(ErrorKind::Other, format!("Error in search: {}", e)))
    let _out_file_path = PathBuf::from(format!("{}.out", input_file.to_string_lossy()));
    let mut matcher_builder = RegexMatcherBuilder::new();
    matcher_builder.multi_line(true);
    let matcher = matcher_builder.build(&pattern).unwrap();
    // let out_file = File::create(&out_file_path)?;
    let mut matched_lines = 0u64;

    let mut builder = SummaryBuilder::new();
    //         args.rs:835: === print_summary, stats: false
    // TRACE|rg::args|crates/core/args.rs:836: === print_summary, max_count: None
    // TRACE|rg::args|crates/core/args.rs:837: === print_summary, include-zero: false
    // TRACE|rg::args|crates/core/args.rs:841: === print_summary, path_separator: None
    // TRACE|rg::args|crates/core/args.rs:845: === print_summary, path_terminator: None
    builder
        .kind(SummaryKind::CountMatches)
        .stats(false)
        .exclude_zero(true)
        .separator_path(None)
        .path_terminator(None);
    let wtr = termcolor::Buffer::no_color();
    let mut summary = builder.build(wtr);
    let _sink = summary.sink_with_path(&matcher, &input_file);

    Searcher::new().search_path(
        &matcher,
        &input_file,
        // sink,
        Bytes(|lnum, line| {
            println!("found match with lnum: {}: len = {}", lnum, line.len());
            matched_lines += 1;
            Ok(true)
        }),
    )?;
    Ok(matched_lines)
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

    /*
    @D.Astafyev: as soon as binary search isn't used, this test is off
    #[test]
    fn test_ripgrep_binary() -> Result<(), std::io::Error> {
        let mut tmp_file = tempfile::NamedTempFile::new()?;
        let file_path = PathBuf::from(tmp_file.path());
        let input_file = tmp_file.as_file_mut();
        input_file.write_all(DLT_LOGS)?;
        let result_content = count_pattern_in_binary(r"\x44\x4C\x54\x01", &file_path)?;
        assert_eq!(2, result_content);
        // assert_eq!(2, matches[0].line);
        // assert_eq!("[Warn](1.4): b", matches[0].content);
        // assert_eq!(4, matches[1].line);
        // assert_eq!("[Err](1.6): d", matches[1].content);
        Ok(())
    }
    */

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
