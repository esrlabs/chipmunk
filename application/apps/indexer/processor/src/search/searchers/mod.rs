use crate::{
    grabber::GrabError,
    search::{
        buffer::{CancallableMinBuffered, REDUX_MIN_BUFFER_SPACE, REDUX_READER_CAPACITY},
        error::SearchError,
    },
};
use buf_redux::BufReader as ReduxReader;
use grep_regex::RegexMatcher;
use grep_searcher::{sinks::UTF8, Searcher};
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    ops::Range,
    path::PathBuf,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub mod regular;
#[cfg(test)]
pub mod tests_regular;
#[cfg(test)]
pub mod tests_values;
pub mod values;
pub trait Base {
    fn get_file_path(&self) -> &PathBuf;
    fn get_bytes_read(&self) -> u64;
    fn set_bytes_read(&mut self, bytes: u64);
    fn get_lines_read(&self) -> u64;
    fn set_lines_read(&mut self, lines: u64);
    fn get_terms(&self) -> Vec<String>;
    fn matching(&mut self, row: u64, line: &str);

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
    fn search(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancallation: CancellationToken,
    ) -> Result<Range<usize>, SearchError> {
        if read_bytes == 0 || read_bytes == self.get_bytes_read() {
            return Ok(0..0);
        }
        if read_bytes < self.get_bytes_read() {
            return Err(SearchError::IoOperation(format!(
                "Invalid amount of read bytes ({read_bytes}). Processed bytes {}",
                self.get_bytes_read()
            )));
        }
        let terms = self.get_terms();
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
                )))
            }
        };
        let in_file = File::open(self.get_file_path()).map_err(|_| {
            GrabError::IoOperation(format!("Could not open file {:?}", self.get_file_path()))
        })?;
        let mut in_file_reader =
            ReduxReader::with_capacity(REDUX_READER_CAPACITY, in_file).set_policy(
                CancallableMinBuffered((REDUX_MIN_BUFFER_SPACE, cancallation)),
            );
        in_file_reader
            .seek(SeekFrom::Start(self.get_bytes_read()))
            .map_err(|_| {
                GrabError::IoOperation(format!(
                    "Could not seek file {:?} to {}",
                    self.get_file_path(),
                    self.get_bytes_read()
                ))
            })?;
        let mut reader_handler = in_file_reader.take(read_bytes - self.get_bytes_read());
        // Take in account: we are counting on all levels (grabbing search, grabbing stream etc)
        // from 0 line always. But grep gives results from 1. That's why here is a point of correct:
        // lnum - 1
        let lines_read = self.get_lines_read();
        let mut processed: usize = 0;
        Searcher::new()
            .search_reader(
                &matcher,
                &mut reader_handler,
                UTF8(|row, line| {
                    self.matching(row + lines_read - 1, line);
                    processed += 1;
                    Ok(true)
                }),
            )
            .map_err(|e| {
                SearchError::IoOperation(format!(
                    "Could not search in file {:?}; error: {e}",
                    self.get_file_path()
                ))
            })?;
        self.set_lines_read(rows_count);
        self.set_bytes_read(read_bytes + 1);
        Ok(lines_read as usize..(lines_read as usize + processed))
    }
}

pub struct BaseSearcher {
    pub file_path: PathBuf,
    pub uuid: Uuid,
    bytes_read: u64,
    lines_read: u64,
}
pub trait SearchResultCollector<State> {
    fn collect(state: &mut State);
}
impl BaseSearcher {
    fn get_file_path(&self) -> &PathBuf {
        &self.file_path
    }
    fn get_bytes_read(&self) -> u64 {
        self.bytes_read
    }
    fn set_bytes_read(&mut self, bytes: u64) {
        self.bytes_read = bytes;
    }
    fn get_lines_read(&self) -> u64 {
        self.lines_read
    }
    fn set_lines_read(&mut self, lines: u64) {
        self.lines_read = lines;
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
    ///
    fn search<F, State>(
        &mut self,
        rows_count: u64,
        read_bytes: u64,
        cancallation: CancellationToken,
        terms: Vec<String>,
        state: &mut State,
        mut f: F,
    ) -> Result<Range<usize>, SearchError>
    where
        F: FnMut(u64, &str, &mut State) -> Result<bool, std::io::Error>,
    {
        if read_bytes == 0 || read_bytes == self.get_bytes_read() {
            return Ok(0..0);
        }
        if read_bytes < self.get_bytes_read() {
            return Err(SearchError::IoOperation(format!(
                "Invalid amount of read bytes ({read_bytes}). Processed bytes {}",
                self.get_bytes_read()
            )));
        }
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
                )))
            }
        };
        let in_file = File::open(self.get_file_path()).map_err(|_| {
            GrabError::IoOperation(format!("Could not open file {:?}", self.get_file_path()))
        })?;
        let mut in_file_reader =
            ReduxReader::with_capacity(REDUX_READER_CAPACITY, in_file).set_policy(
                CancallableMinBuffered((REDUX_MIN_BUFFER_SPACE, cancallation)),
            );
        in_file_reader
            .seek(SeekFrom::Start(self.get_bytes_read()))
            .map_err(|_| {
                GrabError::IoOperation(format!(
                    "Could not seek file {:?} to {}",
                    self.get_file_path(),
                    self.get_bytes_read()
                ))
            })?;
        let mut reader_handler = in_file_reader.take(read_bytes - self.get_bytes_read());
        // Take in account: we are counting on all levels (grabbing search, grabbing stream etc)
        // from 0 line always. But grep gives results from 1. That's why here is a point of correct:
        // lnum - 1
        let lines_read = self.get_lines_read();
        let mut processed: usize = 0;
        Searcher::new()
            .search_reader(
                &matcher,
                &mut reader_handler,
                UTF8(|row, line| {
                    // self.matching(row + lines_read - 1, line);
                    f(row + lines_read - 1, line, state);
                    processed += 1;
                    Ok(true)
                }),
            )
            .map_err(|e| {
                SearchError::IoOperation(format!(
                    "Could not search in file {:?}; error: {e}",
                    self.get_file_path()
                ))
            })?;
        self.set_lines_read(rows_count);
        self.set_bytes_read(read_bytes + 1);
        Ok(lines_read as usize..(lines_read as usize + processed))
    }
}
