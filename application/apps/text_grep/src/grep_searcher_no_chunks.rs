use buf_redux::BufReader;
use grep_regex::RegexMatcherBuilder;
use grep_searcher::{sinks::UTF8, Searcher};
use rayon::prelude::*;
use std::collections::HashMap;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Sender};
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
    pub pattern_locations: HashMap<String, Vec<(u64, usize)>>,
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
    ) -> Result<Vec<Option<SearchResult>>, GrepError> {
        let mut results = Vec::new();

        let (sender, receiver) = mpsc::channel();
        let (error_sender, error_receiver) = mpsc::channel();

        let _thread_handles: Vec<_> = file_paths
            .par_iter()
            .map(|&file_path| {
                if let Err(err) = process_file(
                    file_path,
                    &patterns,
                    case_sensitive,
                    &cancel_token.clone(),
                    &sender,
                ) {
                    if error_sender.send(err.clone()).is_err() {}
                }
            })
            .collect();

        while let Ok(err_msg) = error_receiver.try_recv() {
            results.push(Some(SearchResult {
                file_path: "".to_string(),
                pattern_counts: HashMap::new(),
                pattern_locations: HashMap::new(),
                error_message: Some(err_msg.to_string()),
            }));
        }

        while let Ok(search_result) = receiver.try_recv() {
            results.push(Some(search_result?));
        }

        if cancel_token.is_cancelled() {
            return Ok(vec![None; 0]);
        }

        Ok(results)
    }
}

fn process_file(
    file_path: &str,
    patterns: &[&str],
    case_sensitive: bool,
    cancel_token: &CancellationToken,
    sender: &Sender<Result<SearchResult, GrepError>>,
) -> Result<(), GrepError> {
    let file_path = PathBuf::from(&file_path);

    if !is_text_file(&file_path) {
        let error_msg = format!("File '{}' is not a text file", file_path.display());
        let _ = sender
            .send(Err(GrepError::NotATextFile(error_msg.clone())))
            .is_err();
        return Ok(());
    }

    let start_time = std::time::Instant::now();

    let mut matchers = HashMap::new();
    for pattern in patterns {
        let pattern_string = pattern.to_string();
        let mut matcher_builder = RegexMatcherBuilder::new();

        // Adjust case sensitivity based on the parameter
        if !case_sensitive {
            matcher_builder.case_insensitive(true);
        }

        let matcher = matcher_builder
            .build(&pattern_string)
            .map_err(|e| GrepError::FileProcessingError(e.to_string()))?;
        matchers.insert(pattern_string, matcher);
    }

    let mut local_pattern_counts = HashMap::new();
    let mut local_pattern_locations = HashMap::new(); // New: Track pattern locations

    for (pattern, matcher) in &matchers {
        if cancel_token.is_cancelled() {
            return Err(GrepError::OperationCancelled);
        }
        let mut total_count = 0;
        let mut locations = Vec::new();
        let mut searcher = Searcher::new();

        // Reset reader position for each pattern search
        let file = File::open(&file_path).map_err(|e| GrepError::FileReadError(e.to_string()))?;
        let reader = BufReader::new(file); // BufReader::with_capacity(64*1024*1024, file); // buf_redux's BufReader

        searcher
            .search_reader(
                matcher,
                reader,
                UTF8(|line_index, line| {
                    // line_number += 1;
                    // Convert both line and pattern to lowercase (or uppercase) for case-insensitive matching
                    let line_to_match = if case_sensitive {
                        line.to_string()
                    } else {
                        line.to_lowercase()
                    };
                    let pattern_to_match = if case_sensitive {
                        pattern.to_string()
                    } else {
                        pattern.to_lowercase()
                    };
                    total_count += line_to_match.matches(&pattern_to_match).count();

                    // Track positions of pattern occurrences
                    for mat in line_to_match.match_indices(&pattern_to_match) {
                        locations.push((line_index, mat.0)); // Record the position of the match
                    }
                    Ok(true)
                }),
            )
            .map_err(|e| GrepError::FileProcessingError(e.to_string()))?;

        local_pattern_counts.insert(pattern.clone(), total_count);
        local_pattern_locations.insert(pattern.clone(), locations); // Save pattern locations
    }

    let end_time = start_time.elapsed();
    eprintln!("Time taken {:?}", end_time);

    sender
        .send(Ok(SearchResult {
            file_path: file_path.to_string_lossy().into_owned(),
            pattern_counts: local_pattern_counts,
            pattern_locations: local_pattern_locations,
            error_message: None,
        }))
        .map_err(|_| {
            GrepError::FileProcessingError(
                "Error sending search result through channel".to_string(),
            )
        })?;

    Ok(())
}

fn is_text_file(_file_path: &Path) -> bool {
    true
}
