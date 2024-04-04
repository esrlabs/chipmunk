//! `text_grep` is a crate for searching text patterns within files using regular expressions.
//!
//! This crate provides functionality to search for multiple patterns within multiple files concurrently.
//! It supports both case-sensitive and case-insensitive search modes.
//!
//! # Examples
//!
//! ```rust
//! use std::path::PathBuf;
//! use text_grep::count_occurrences;
//! use tokio_util::sync::CancellationToken;
//!
//! #[tokio::main]
//! async fn main() {
//!     // Patterns to search for
//!     let patterns = ["text", "administrator", "HTTP"];
//!
//!     // File paths to search within
//!     let file_paths = [
//!         PathBuf::from("indexing_access_huge.log"),
//!         PathBuf::from("indexing_access_huge.log"),
//!         PathBuf::from("Cargo.toml"),
//!     ];
//!
//!     // Create a cancellation token
//!     let cancel_token = CancellationToken::new();
//!
//!     // Perform the search
//!     match count_occurrences(
//!         &patterns,
//!         &file_paths.iter().collect::<Vec<&PathBuf>>(),
//!         true,
//!         cancel_token,
//!     )
//!     .await
//!     {
//!         Ok(results) => {
//!             for result in results {
//!                 match result {
//!                     Ok(search_result) => {
//!                         // Process successful search result
//!                         println!("{:?}", search_result);
//!                     }
//!                     Err(err) => {
//!                         // Handle error
//!                         eprintln!("Error: {}", err);
//!                     }
//!                 }
//!             }
//!         }
//!         Err(err) => {
//!             // Handle error
//!             eprintln!("Error: {}", err);
//!         }
//!     }
//! }
//! ```
//!
//! # Public Functions
//!
//! - `count_occurrences`: Asynchronously searches for multiple patterns within multiple files.
//!   - Parameters:
//!     - `patterns`: An array of string slices representing patterns to search for.
//!     - `file_paths`: An array of `PathBuf` representing paths to files to search within.
//!     - `case_sensitive`: A boolean indicating whether the search should be case-sensitive or not.
//!     - `cancel_token`: A `CancellationToken` used for cancellation of the operation.
//!   - Returns:
//!     - `Result<Vec<Result<SearchResult, GrepError>>, GrepError>`: A vector of results containing either `SearchResult` or `GrepError`.
//!
//! # Error Handling
//!
//! - `GrepError` represents various errors that may occur during the search process.
//!   - `NotATextFile`: Indicates that a file is not a text file.
//!   - `FileReadError`: Indicates an error occurred while reading a file.
//!   - `FileProcessingError`: Indicates an error occurred while processing a file.
//!   - `OperationCancelled`: Indicates that the operation was cancelled.
//!   - `BuilingRegExError`: Indicates an error occurred while building a regular expression for searching.
//!   - `RegExError`: Indicates an error occurred with a regular expression.
//!   - `IOError`: Indicates an I/O error occurred.
//!
//! # Types
//!
//! - `SearchResult`: Represents the result of searching within a file.
//!   - `file_path`: A `String` representing the path of the file.
//!   - `pattern_counts`: A `HashMap` containing the counts of occurrences of each pattern within the file.
//!   - `error_message`: An optional `String` containing an error message if any error occurred during the search.
//!
//! # Modules
//!
//! - `buffer`: Module for handling buffered I/O.
//! - `GrepError`: Module defining custom error types for the crate.
//!
//! # Dependencies
//!
//! - `buf_redux`: Provides buffered I/O functionality.
//! - `grep_regex`: Facilitates regular expression searching.
//! - `grep_searcher`: Implements file searching capabilities.
//! - `regex`: Provides regular expression support.
//! - `thiserror`: Simplifies error handling.
//!
//! # Additional Notes
//!
//! - This crate assumes that all files are text files.
//! - It utilizes asynchronous operations for efficiency, particularly in handling large files.
//! - Cancellation of ongoing operations is supported using a `CancellationToken`.
//! - Errors are handled using the `GrepError` enum, providing detailed error information.
//! - Regular expressions for searching are constructed dynamically based on user-provided patterns.
//! - Both case-sensitive and case-insensitive searches are supported based on user preference.

pub mod buffer;
use crate::buffer::{CancallableMinBuffered, REDUX_MIN_BUFFER_SPACE, REDUX_READER_CAPACITY};
use buf_redux::BufReader;
use grep_regex::{RegexMatcher, RegexMatcherBuilder};
use grep_searcher::{sinks::UTF8, Searcher};
use regex::Regex;
use std::{
    collections::HashMap,
    fs::File,
    io,
    path::{Path, PathBuf},
};
use thiserror::Error;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Error, Clone)]
pub enum GrepError {
    #[error("File '{0}' is not a text file")]
    NotATextFile(String),
    #[error("Error reading file: {0}")]
    FileReadError(String),
    #[error("Error processing file: {0}")]
    FileProcessingError(String),
    #[error("Operation cancelled")]
    OperationCancelled,
    #[error("Error building regex: {0}")]
    BuilingRegExError(grep_regex::Error),
    #[error("Error building regex: {0}")]
    RegExError(regex::Error),
    #[error("IO error: {0}")]
    IOError(String),
}

impl From<grep_regex::Error> for GrepError {
    fn from(e: grep_regex::Error) -> Self {
        Self::BuilingRegExError(e)
    }
}

impl From<regex::Error> for GrepError {
    fn from(e: regex::Error) -> Self {
        Self::RegExError(e)
    }
}

impl From<io::Error> for GrepError {
    fn from(e: io::Error) -> Self {
        Self::IOError(e.to_string())
    }
}

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub file_path: String,
    pub pattern_counts: HashMap<String, usize>,
    pub error_message: Option<String>,
}

fn get_matcher(patterns: &[&str], case_sensitive: bool) -> Result<RegexMatcher, GrepError> {
    Ok(RegexMatcherBuilder::new()
        .case_insensitive(!case_sensitive)
        .build(
            &patterns
                .iter()
                .map(|pattern| regex::escape(pattern))
                .collect::<Vec<String>>()
                .join("|"),
        )?)
}

fn get_patterns_as_regs(patterns: &[&str], case_sensitive: bool) -> Result<Vec<Regex>, GrepError> {
    let mut regs: Vec<Regex> = Vec::new();
    for pattern in patterns.iter() {
        let regex_builder = if case_sensitive {
            Regex::new(pattern)?
        } else {
            Regex::new(&format!("(?i){}", regex::escape(pattern)))?
        };
        regs.push(regex_builder);
    }
    Ok(regs)
}

fn process_file(
    file_path: &PathBuf,
    matcher: &RegexMatcher,
    patterns: &[Regex],
    cancel_token: &CancellationToken,
) -> Result<SearchResult, GrepError> {
    if !is_text_file(file_path) {
        return Ok(SearchResult {
            file_path: file_path.to_string_lossy().into_owned(),
            pattern_counts: HashMap::new(),
            error_message: Some(format!("File '{}' is not a text file", file_path.display())),
        });
    }
    let mut pattern_counts = HashMap::new();
    let file = File::open(file_path)?;
    let reader = BufReader::with_capacity(REDUX_READER_CAPACITY, file).set_policy(
        CancallableMinBuffered((REDUX_MIN_BUFFER_SPACE, cancel_token.clone())),
    );
    let mut searcher = Searcher::new();
    searcher
        .search_reader(
            matcher,
            reader,
            UTF8(|_, line| {
                for pattern in patterns {
                    let count_entry = pattern_counts.entry((*pattern).to_string()).or_insert(0);
                    *count_entry += pattern.captures_iter(line).count();
                }
                Ok(true)
            }),
        )
        .map_err(|e| GrepError::FileProcessingError(format!("Error processing file: {}", e)))?;

    // Alter pattern_counts to have original patterns without (?i)
    let mut altered_pattern_counts = HashMap::new();
    for (pattern, count) in &pattern_counts {
        let original_pattern = unset_case_insensitivity_flag(pattern);
        altered_pattern_counts.insert(original_pattern, *count);
    }

    Ok(SearchResult {
        file_path: file_path.to_string_lossy().into_owned(),
        pattern_counts: altered_pattern_counts,
        error_message: None,
    })
}

fn unset_case_insensitivity_flag(pattern: &str) -> String {
    if pattern.starts_with("(?i)") {
        pattern.chars().skip(4).collect()
    } else {
        pattern.to_string()
    }
}

fn is_text_file(_file_path: &Path) -> bool {
    true
}

pub async fn count_occurrences(
    patterns: &[&str],
    file_paths: &[&PathBuf],
    case_sensitive: bool,
    cancel_token: CancellationToken,
) -> Result<Vec<Result<SearchResult, GrepError>>, GrepError> {
    let mut results = Vec::new();
    let matcher = get_matcher(patterns, case_sensitive)?;
    let regs = get_patterns_as_regs(patterns, case_sensitive)?;
    for file_path in file_paths {
        if cancel_token.is_cancelled() {
            return Err(GrepError::OperationCancelled); // Return early if cancellation requested
        }
        results.push(process_file(file_path, &matcher, &regs, &cancel_token));
    }
    Ok(results)
}
