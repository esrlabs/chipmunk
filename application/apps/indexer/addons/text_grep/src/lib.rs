//! `text_grep` is a crate for searching text patterns within files using regular expressions.
//!
//! This crate provides functionality to search for multiple patterns within multiple files concurrently.
//! It supports both case-sensitive and case-insensitive search modes.
//!
//! The crate assumes that the files passed to the function count_occurrences are text files only.
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
//!     let patterns = ["pattern1", "pattern2", "PATTERN3"];
//!
//!     // File paths to search within
//!     let file_paths = [
//!         PathBuf::from("first_text_file.log"),
//!         PathBuf::from("second_text_file.txt"),
//!         PathBuf::from("third_text_file.txt"),
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
use std::{collections::HashMap, fs::File, io, path::PathBuf};
use thiserror::Error;
use tokio_util::sync::CancellationToken;

/// An enumeration of possible errors that can occur during the grep operation.
#[derive(Debug, Error, Clone)]
pub enum GrepError {
    /// Error reading a file.
    #[error("Error reading file: {0}")]
    FileReadError(String),
    /// Error processing a file.
    #[error("Error processing file: {0}")]
    FileProcessingError(String),
    /// Operation was cancelled.
    #[error("Operation cancelled")]
    OperationCancelled,
    /// Error building a regular expression matcher.
    #[error("Error building regex: {0}")]
    BuilingRegExError(grep_regex::Error),
    /// Error building a regular expression.
    #[error("Error building regex: {0}")]
    RegExError(regex::Error),
    /// IO error.
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

/// Represents the result of searching for patterns in a file.
#[derive(Debug, Clone)]
pub struct SearchResult {
    /// Path of the file.
    pub file_path: String,
    /// Counts of occurrences for each pattern.
    pub pattern_counts: HashMap<String, usize>,
    /// Optional error message.
    pub error_message: Option<String>,
}

/// Constructs a `RegexMatcher` based on the provided patterns and case sensitivity flag.
///
/// # Arguments
///
/// * `patterns` - An array of patterns to search for.
/// * `case_sensitive` - A flag indicating whether the search should be case-sensitive.
///
/// # Returns
///
/// A `RegexMatcher` instance.
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

/// Builds a vector of `Regex` instances from the input patterns, handling case sensitivity appropriately.
///
/// # Arguments
///
/// * `patterns` - An array of patterns to search for.
/// * `case_sensitive` - A flag indicating whether the search should be case-sensitive.
///
/// # Returns
///
/// A vector of `Regex` instances.
fn get_patterns_as_regs(patterns: &[&str], case_sensitive: bool) -> Result<Vec<Regex>, GrepError> {
    let regs: Result<Vec<Regex>, GrepError> = patterns
        .iter()
        .map(|&pattern| {
            // Validate the pattern
            let regex = Regex::new(pattern).map_err(GrepError::RegExError)?;

            // Format the pattern if case-insensitive search is required
            if !case_sensitive {
                let formatted_pattern = format!("(?i){}", regex.as_str());
                Regex::new(&formatted_pattern).map_err(GrepError::RegExError)
            } else {
                Ok(regex)
            }
        })
        .collect();

    regs
}

/// Processes a single file, searching for patterns using a `Searcher` and updating the pattern counts accordingly.
///
/// # Arguments
///
/// * `file_path` - Path to the file.
/// * `matcher` - A `RegexMatcher` to use for matching patterns.
/// * `patterns` - A vector of `Regex` instances representing the patterns to search for.
/// * `cancel_token` - A cancellation token to cancel the operation.
///
/// # Returns
///
/// A `SearchResult` containing pattern counts for the file.
fn process_file(
    file_path: &PathBuf,
    matcher: &RegexMatcher,
    patterns: &[Regex],
    cancel_token: &CancellationToken,
) -> Result<SearchResult, GrepError> {
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

/// Removes the case-insensitivity flag from a pattern, if present.
///
/// # Arguments
///
/// * `pattern` - The pattern to process.
///
/// # Returns
///
/// A string with the case-insensitivity flag removed.
fn unset_case_insensitivity_flag(pattern: &str) -> String {
    if pattern.starts_with("(?i)") {
        pattern.chars().skip(4).collect()
    } else {
        pattern.to_string()
    }
}

/// Asynchronously counts pattern occurrences in multiple files.
///
/// # Arguments
///
/// * `patterns` - An array of patterns to search for.
/// * `file_paths` - An array of file paths to search within.
/// * `case_sensitive` - A flag indicating whether the search should be case-sensitive.
/// * `cancel_token` - A cancellation token to cancel the operation.
///
/// # Returns
///
/// A vector of search results, each corresponding to a file.
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
