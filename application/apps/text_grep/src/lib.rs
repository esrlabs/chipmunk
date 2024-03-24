pub mod buffer;
use crate::buffer::{CancallableMinBuffered, REDUX_MIN_BUFFER_SPACE, REDUX_READER_CAPACITY};
use buf_redux::BufReader;
use grep_regex::RegexMatcherBuilder;
use grep_searcher::{sinks::UTF8, Searcher};
use std::collections::HashMap;
use std::fs::File;
use std::path::{Path, PathBuf};
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
}

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub file_path: String,
    pub pattern_counts: HashMap<String, usize>,
    pub error_message: Option<String>,
}

pub struct TextGrep;

impl Default for TextGrep {
    fn default() -> Self {
        TextGrep::new()
    }
}

impl TextGrep {
    pub fn new() -> Self {
        TextGrep
    }

    pub async fn count_occurrences(
        &self,
        patterns: Vec<&str>,
        file_paths: Vec<&str>,
        case_sensitive: bool,
        cancel_token: CancellationToken,
    ) -> Result<Vec<Result<SearchResult, GrepError>>, GrepError> {
        let mut results = Vec::new();

        for file_path in file_paths {
            if cancel_token.is_cancelled() {
                return Err(GrepError::OperationCancelled); // Return early if cancellation requested
            }
            match process_file(file_path, &patterns, case_sensitive, &cancel_token) {
                Ok(result) => results.push(Ok(result)),
                Err(err) => results.push(Err(err)),
            }
        }

        Ok(results)
    }
}

fn process_file(
    file_path: &str,
    patterns: &[&str],
    case_sensitive: bool,
    cancel_token: &CancellationToken,
) -> Result<SearchResult, GrepError> {
    let file_path = PathBuf::from(&file_path);

    if !is_text_file(&file_path) {
        let error_msg = format!("File '{}' is not a text file", file_path.display());
        return Ok(SearchResult {
            file_path: file_path.to_string_lossy().into_owned(),
            pattern_counts: HashMap::new(),
            error_message: Some(error_msg),
        });
    }

    let start_time = std::time::Instant::now();

    let combined_regex_pattern = patterns.join("|");
    let combined_regex = match RegexMatcherBuilder::new().build(&combined_regex_pattern) {
        Ok(regex) => regex,
        Err(e) => {
            return Err(GrepError::FileProcessingError(format!(
                "Error building regex: {}",
                e
            )));
        }
    };

    let mut local_pattern_counts = HashMap::new();

    match File::open(&file_path) {
        Ok(file) => {
            let reader = BufReader::with_capacity(REDUX_READER_CAPACITY, file).set_policy(
                CancallableMinBuffered((REDUX_MIN_BUFFER_SPACE, cancel_token.clone())),
            );

            let mut searcher = Searcher::new();
            if let Err(e) = searcher.search_reader(
                &combined_regex,
                reader,
                UTF8(|_, line| {
                    let line_to_match = if case_sensitive {
                        line.to_string()
                    } else {
                        line.to_lowercase()
                    };

                    for pattern in patterns {
                        if cancel_token.is_cancelled() {
                            return Ok(false);
                        }

                        let pattern_to_match = if case_sensitive {
                            pattern.to_string()
                        } else {
                            pattern.to_lowercase()
                        };

                        let mut total_count = 0;
                        total_count += line_to_match.matches(&pattern_to_match).count();

                        let count_entry = local_pattern_counts
                            .entry((*pattern).to_string())
                            .or_insert(0);
                        *count_entry += total_count;
                    }
                    Ok(true)
                }),
            ) {
                return Err(GrepError::FileProcessingError(format!(
                    "Error processing file: {}",
                    e
                )));
            }
        }
        Err(e) => {
            return Err(GrepError::FileReadError(format!(
                "Error reading file: {}",
                e
            )));
        }
    }

    let end_time = start_time.elapsed();
    eprintln!("Time taken {:?}", end_time);

    Ok(SearchResult {
        file_path: file_path.to_string_lossy().into_owned(),
        pattern_counts: local_pattern_counts,
        error_message: None,
    })
}

fn is_text_file(_file_path: &Path) -> bool {
    true
}
