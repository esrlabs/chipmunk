use std::sync::{mpsc, Arc};
use std::thread;
use tokio_util::sync::CancellationToken;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs::File;
use std::io::{BufReader, Read};
use std::time::Instant;

#[derive(Debug)]
pub struct SearchResult {
  pub file_path: String,
  pub pattern_counts: HashMap<String, usize>,
  pub error_message: Option<String>, // Include an optional error message field
}

pub struct TextGrep;

impl TextGrep {
  pub fn new() -> Self {
    TextGrep
  }

  pub async fn count_occurrences(
    &self,
    patterns: Vec<&str>,
    file_paths: Vec<&str>,
    chunk_size: usize,
    cancel_token: CancellationToken,
  ) -> Result<Vec<SearchResult>, String> {
    let mut results = Vec::new();

    let cancel_token_clone = cancel_token.clone();

    // Create a channel for sending search results from threads to the main thread
    let (sender, receiver) = mpsc::channel();
    let (error_sender, error_receiver) = mpsc::channel();


    let patterns_arc: Vec<_> = patterns.iter().map(|&p| Arc::from(p)).collect();
    let file_paths_arc: Vec<_> = file_paths.iter().map(|&fp| Arc::from(fp)).collect();

    // spawn a thread for each file to read it concurrently
    let thread_handles: Vec<_> = file_paths_arc
      .iter()
      .map(|file_path| {
        let patterns = patterns_arc.clone();
        let sender = sender.clone();
        let error_sender_clone = error_sender.clone();
        let cancel_token = cancel_token_clone.clone();
        let file_path = Arc::clone(file_path);
        thread::spawn(move || {
          if let Err(err) = process_file(&file_path, &patterns, chunk_size, &cancel_token, &sender) {
            if error_sender_clone.send(err.to_string()).is_err() {
              eprintln!("Error sending error message through channel");
            }
          }
        })
      })
      .collect();

    eprintln!("Reached till before join of handles");
    // Wait for all threads to finish
    for handle in thread_handles {
      handle.join().unwrap();
    }

    eprintln!("Reached till after join of handles");

    while let Ok(err_msg) = error_receiver.try_recv() {
      eprintln!("Error processing file: {:?}", err_msg);
      // Push a SearchResult with the error message
      results.push(SearchResult {
        file_path: "".to_string(),
        pattern_counts: HashMap::new(),
        error_message: Some(err_msg.to_string()),
      });
    }

    // Loop to receive search results
    while let Ok(search_result) = receiver.try_recv() {
      results.push(search_result?);
    }

    Ok(results)
  }
}

fn process_file(
  file_path: &Arc<str>,
  patterns: &[Arc<str>],
  chunk_size: usize,
  cancel_token: &CancellationToken,
  sender: &mpsc::Sender<Result<SearchResult, String>>,
) -> Result<(), String> {
  let file_path = PathBuf::from(&**file_path);
  if !is_text_file(&file_path) {
    let error_msg = format!("File '{}' is not a text file", file_path.display());
    if sender.send(Err(error_msg.clone())).is_err() {
      eprintln!("Error sending search result through channel");
    }
    return Ok(());
  }

  let mut pattern_counts = HashMap::new();
  let start_time = Instant::now();
  eprintln!("Trying to process file {:?}", file_path);
  // Preparing searchers for all patterns
  let searchers: Vec<_> = patterns
    .iter()
    .map(|pattern| {
      aho_corasick::AhoCorasickBuilder::new()
        .match_kind(aho_corasick::MatchKind::Standard)
        .ascii_case_insensitive(true)
        .build(vec![&**pattern])
    })
    .collect::<Result<_, _>>()
    .map_err(|e| e.to_string())?;

  eprintln!("Trying to Open file {:?}", file_path);
  let file = File::open(&file_path).map_err(|e| e.to_string())?;
  let mut reader = BufReader::new(file);
  let mut buffer = vec![0; chunk_size];

  loop {
    if cancel_token.is_cancelled() {
      return Err("Operation cancelled".to_string());
    }

    // eprintln!("Trying to Read file {:?}", file_path);
    let bytes_read = reader.read(&mut buffer).map_err(|e| e.to_string())?;

    // eprintln!("After reading chunk in file {:?}", file_path);
    if bytes_read == 0 {
      break;
    }

    let content = String::from_utf8_lossy(&buffer[..bytes_read]);
    for (pattern_index, searcher) in searchers.iter().enumerate() {
      let mut count = 0;
      for _mat in searcher.find_iter(&*content) {
        count += 1;
      }
      pattern_counts.insert((*patterns[pattern_index]).to_string(), count);
      // eprintln!("After reading chunk in file {:?}, count is {} ", file_path, count);
    }
  }

  let end_time = start_time.elapsed();
  eprintln!("Time taken {:?}", end_time);

  sender.send(Ok(SearchResult {
    file_path: file_path.to_string_lossy().into_owned(),
    pattern_counts,
    error_message: None, // No error message for successful result
  })).map_err(|e| e.to_string())?;

  eprintln!("Finally outside the loop 2");

  Ok(())
}

fn is_text_file(_file_path: &Path) -> bool {
  true
}