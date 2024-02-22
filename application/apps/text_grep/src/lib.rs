use grep_regex::RegexMatcher;
use rayon::prelude::*;
use regex::Regex;
use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Sender};
use std::time::Instant;
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
        chunk_size: usize,
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
                    chunk_size,
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

fn process_chunk(
    buffer: &[u8],
    matchers: &HashMap<String, RegexMatcher>,
    case_sensitive: bool,
) -> Result<HashMap<String, usize>, GrepError> {
    let mut local_pattern_counts = HashMap::new();

    for pattern in matchers.keys() {
        let mut total_count = 0;

        let regex = if case_sensitive {
            Regex::new(pattern).map_err(|e| GrepError::FileProcessingError(e.to_string()))?
        } else {
            Regex::new(&format!("(?i){}", pattern))
                .map_err(|e| GrepError::FileProcessingError(e.to_string()))?
        };

        let text = String::from_utf8_lossy(buffer);
        total_count += regex.find_iter(&text).count();

        local_pattern_counts.insert(pattern.clone(), total_count);
    }

    Ok(local_pattern_counts)
}

fn process_file(
    file_path: &str,
    patterns: &[&str],
    chunk_size: usize,
    case_sensitive: bool,
    cancel_token: &CancellationToken,
    sender: &Sender<Result<SearchResult, GrepError>>,
) -> Result<(), GrepError> {
    let file_path = PathBuf::from(file_path);

    if !is_text_file(&file_path) {
        let error_msg = format!("File '{}' is not a text file", file_path.display());
        let _ = sender
            .send(Err(GrepError::NotATextFile(error_msg.clone())))
            .is_err();
        return Ok(());
    }

    let start_time = Instant::now();
    let mut file =
        std::fs::File::open(&file_path).map_err(|e| GrepError::FileReadError(e.to_string()))?;
    let mut buffer = vec![0; chunk_size]; // define a buffer to read chunks of data
    let mut incomplete_line = String::new();

    // create matchers for each pattern and store them with their corresponding patterns in a hashmap
    let mut matchers = HashMap::new();
    for pattern in patterns {
        let pattern_string = pattern.to_string();
        let matcher = RegexMatcher::new(&pattern_string)
            .map_err(|e| GrepError::FileProcessingError(e.to_string()))?;
        matchers.insert(pattern_string, matcher);
    }

    let mut results = Vec::new(); // Vector to collect results from each thread

    loop {
        if cancel_token.is_cancelled() {
            return Err(GrepError::OperationCancelled);
        }
        let bytes_read = file
            .read(&mut buffer)
            .map_err(|e| GrepError::FileReadError(e.to_string()))?;
        if bytes_read == 0 {
            // Reached EOF, process incomplete line if any
            if !incomplete_line.is_empty() {
                let local_pattern_counts =
                    process_chunk(incomplete_line.as_bytes(), &matchers, case_sensitive)?;
                results.push(local_pattern_counts);
            }
            break;
        }

        // Check if there's an incomplete line from the previous chunk
        let mut chunk = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();
        if !incomplete_line.is_empty() {
            chunk = incomplete_line.clone() + &chunk;
            incomplete_line.clear();
        }

        // Find the last newline character in the chunk
        let last_newline_index = match chunk.rfind('\n') {
            Some(idx) => idx,
            None => {
                // If no newline is found, keep the chunk for the next iteration
                incomplete_line = chunk;
                continue;
            }
        };

        // Split the chunk at the last newline character
        let (complete_chunk, remainder) = chunk.split_at(last_newline_index + 1);

        // Process the complete chunk
        let local_pattern_counts =
            process_chunk(complete_chunk.as_bytes(), &matchers, case_sensitive)?;
        results.push(local_pattern_counts);

        // Store the remainder for the next iteration
        incomplete_line = remainder.to_string();
    }

    let mut aggregated_pattern_counts = HashMap::new();
    for pattern_count in &results {
        for (pattern, count) in pattern_count {
            *aggregated_pattern_counts
                .entry(pattern.to_string())
                .or_insert(0) += count;
        }
    }

    let end_time = start_time.elapsed();
    eprintln!("Time taken {:?}", end_time);

    sender
        .send(Ok(SearchResult {
            file_path: file_path.to_string_lossy().into_owned(),
            pattern_counts: aggregated_pattern_counts,
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
