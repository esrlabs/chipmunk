use crate::{grabber::GrabError, search::error::SearchError};
use grep_regex::RegexMatcher;
use grep_searcher::{Searcher, sinks::UTF8};
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    ops::Range,
    path::{Path, PathBuf},
};
use text_grep::buffer::CancellableBufReader;
use tokio_util::sync::CancellationToken;

pub mod linear;
pub mod regular;
#[cfg(test)]
pub mod tests_linear;
#[cfg(test)]
pub mod tests_regular;
#[cfg(test)]
pub mod tests_values;
pub mod values;

#[derive(Debug)]
pub struct BaseSearcher<State: SearchState> {
    pub file_path: PathBuf,
    bytes_read: u64,
    lines_read: u64,
    search_state: State,
}
pub trait SearchState {
    type SearchResultType;
    fn new(path: &Path) -> Self;
    fn get_terms(&self) -> Vec<String>;
}

impl<State: SearchState> BaseSearcher<State> {
    pub fn new(path: &Path, rows_count: u64, read_bytes: u64) -> Self {
        let search_state = State::new(path);
        Self {
            file_path: PathBuf::from(path),
            bytes_read: read_bytes,
            lines_read: rows_count,
            search_state,
        }
    }

    /// Execute a search for the given file and filters collecting the findings
    /// with the provided collect function.
    ///
    /// # Returns
    /// Returns a range containing the absolute line numbers of all matches found
    /// during this specific call.
    fn search<F>(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancel_token: CancellationToken,
        mut collect_fn: F,
    ) -> Result<Range<usize>, SearchError>
    where
        F: FnMut(u64, &str, &mut State),
    {
        if read_bytes == 0 || read_bytes == self.bytes_read {
            return Ok(0..0);
        }
        if read_bytes < self.bytes_read {
            return Err(SearchError::IoOperation(format!(
                "Invalid amount of read bytes ({read_bytes}). Processed bytes {}",
                self.bytes_read
            )));
        }
        let terms = self.search_state.get_terms();
        if terms.is_empty() {
            return Err(SearchError::Input(
                "Cannot search without filters".to_owned(),
            ));
        }
        let combined_regex: String = format!("({})", terms.join("|"));
        let matcher = match RegexMatcher::new(&combined_regex) {
            Ok(regex) => regex,
            Err(err) => {
                return Err(SearchError::Regex(format!(
                    "Failed to create combined regex for {combined_regex}: {err}"
                )));
            }
        };
        let in_file = File::open(&self.file_path).map_err(|_| {
            GrabError::IoOperation(format!("Could not open file {:?}", self.file_path))
        })?;
        let mut in_file_reader = CancellableBufReader::new(in_file, cancel_token);
        in_file_reader
            .seek(SeekFrom::Start(self.bytes_read))
            .map_err(|_| {
                GrabError::IoOperation(format!(
                    "Could not seek file {:?} to {}",
                    self.file_path, self.bytes_read
                ))
            })?;
        let mut reader_handler = in_file_reader.take(read_bytes - self.bytes_read);
        // Take in account: we are counting on all levels (grabbing search, grabbing stream etc)
        // from 0 line always. But grep gives results from 1. That's why here is a point of correct:
        // lnum - 1
        let lines_read = self.lines_read;
        let mut processed: usize = 0;
        Searcher::new()
            .search_reader(
                &matcher,
                &mut reader_handler,
                UTF8(|row, line| {
                    // self.matching(row + lines_read - 1, line);
                    collect_fn(row + lines_read - 1, line, &mut self.search_state);
                    processed += 1;
                    Ok(true)
                }),
            )
            .map_err(|e| {
                SearchError::IoOperation(format!(
                    "Could not search in file {:?}; error: {e}",
                    self.file_path
                ))
            })?;
        self.lines_read = rows_count;
        self.bytes_read = read_bytes + 1;
        Ok(lines_read as usize..(lines_read as usize + processed))
    }
}
