use crate::grabber::{
    identify_byte_range, ByteRange, GrabError, GrabMetadata, GrabbedContent, GrabbedElement,
    LineRange, Slot,
};
use buf_redux::{policy::MinBuffered, BufReader as ReduxReader};
use indexer_base::progress::ComputationResult;
use std::{
    fs,
    io::{Read, SeekFrom},
    path::{Path, PathBuf},
};
use tokio_util::sync::CancellationToken;

const REDUX_READER_CAPACITY: usize = 1024 * 1024;
const REDUX_MIN_BUFFER_SPACE: usize = 10 * 1024;

#[derive(Debug)]
pub struct TextFileSource {
    source_id: String,
    path: PathBuf,
    read_bytes: u64,
}

impl TextFileSource {
    pub fn new(p: &Path, id: &str) -> Self {
        Self {
            source_id: id.to_string(),
            path: PathBuf::from(p),
            read_bytes: 0,
        }
    }
}

impl TextFileSource {
    pub fn contains_text(path: &Path) -> Result<bool, GrabError> {
        let chunk_size = 100 * 1024usize;
        let mut f = fs::File::open(&path)
            .map_err(|_| GrabError::IoOperation(format!("Could not open file {:?}", &path)))?;
        let mut count = 0usize;
        let mut buffer = vec![0; chunk_size];

        let n = f
            .read(&mut buffer)
            .map_err(|_| GrabError::IoOperation(format!("Could not read from file {:?}", &path)))?;
        if n < chunk_size {
            buffer.resize(n, 0);
        }
        count += bytecount::count(&buffer, b'\n');
        Ok(count > 0)
    }
}

impl TextFileSource {
    pub fn source_id(&self) -> String {
        self.source_id.clone()
    }

    /// the path of the file that is the source for the content
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// will return the number of log entries in a file.
    pub fn count_lines(&self) -> Result<usize, GrabError> {
        let chunk_size = 100 * 1024usize;
        let mut f = fs::File::open(&self.path)
            .map_err(|_| GrabError::IoOperation(format!("Could not open file {:?}", &self.path)))?;
        let mut count = 0usize;
        let mut buffer = vec![0; chunk_size];

        loop {
            let n = f.read(&mut buffer).map_err(|_| {
                GrabError::IoOperation(format!("Could not read from file {:?}", &self.path))
            })?;
            if n < chunk_size {
                buffer.resize(n, 0);
            }
            if n == 0 {
                break;
            }
            count += bytecount::count(&buffer, b'\n');
            if n < chunk_size {
                break;
            }
        }
        Ok(count)
    }

    /// the size of the input content
    pub fn input_size(&self) -> Result<u64, GrabError> {
        let input_file_size = std::fs::metadata(&self.path())
            .map_err(|e| {
                GrabError::Config(format!("Could not determine size of input file: {}", e))
            })?
            .len();
        Ok(input_file_size)
    }

    pub fn from_file(
        &mut self,
        shutdown_token: Option<CancellationToken>,
    ) -> Result<ComputationResult<GrabMetadata>, GrabError> {
        use std::io::prelude::*;
        let file_metadata = fs::metadata(&self.path).map_err(|_| {
            GrabError::IoOperation(format!("Could not get metadata for file {:?}", &self.path))
        })?;
        if !file_metadata.is_file() {
            return Err(GrabError::Config(format!(
                "File {} does not exist",
                self.path.to_string_lossy()
            )));
        }
        let mut f = fs::File::open(&self.path)
            .map_err(|_| GrabError::IoOperation(format!("Could not open file {:?}", &self.path)))?;
        f.seek(SeekFrom::Start(self.read_bytes)).map_err(|_| {
            GrabError::IoOperation(format!(
                "Could not seek file {:?} to {}",
                &self.path, self.read_bytes
            ))
        })?;
        let mut slots = Vec::<Slot>::new();
        let mut byte_offset = 0u64;
        let mut log_msg_cnt = 0u64;

        let mut reader = ReduxReader::with_capacity(REDUX_READER_CAPACITY, f)
            .set_policy(MinBuffered(REDUX_MIN_BUFFER_SPACE));

        loop {
            if let Some(shutdown_token) = &shutdown_token {
                if shutdown_token.is_cancelled() {
                    return Ok(ComputationResult::Stopped);
                }
            }
            match reader.fill_buf() {
                Ok(content) => {
                    if content.is_empty() {
                        // everything was processed
                        self.read_bytes = byte_offset;
                        break;
                    }

                    let (nl, offset_last_newline) = count_lines_up_to_last_newline(content);
                    let (slot, consumed, processed_lines) = if nl == 0 {
                        let consumed = content.len() as u64;
                        // we hit a very long line that exceeds our read buffer, best
                        // to package everything we read into an entry and start a new one
                        let slot = Slot {
                            bytes: ByteRange::from(byte_offset..=(byte_offset + consumed) - 1),
                            lines: LineRange::from(log_msg_cnt..=log_msg_cnt),
                        };
                        (slot, consumed, 1)
                    } else {
                        let consumed = offset_last_newline as u64 + 1;
                        let slot = Slot {
                            bytes: ByteRange::from(byte_offset..=(byte_offset + consumed - 1)),
                            lines: LineRange::from(log_msg_cnt..=(log_msg_cnt + nl) - 1),
                        };
                        (slot, consumed, nl)
                    };
                    reader.consume(consumed as usize);
                    slots.push(slot);
                    byte_offset += consumed;
                    log_msg_cnt += processed_lines;
                }
                Err(e) => {
                    trace!("no more content");
                    return Err(GrabError::Config(format!(
                        "error for filling buffer with more content: {:?}",
                        e
                    )));
                }
            }
        }

        Ok(ComputationResult::Item(GrabMetadata {
            slots,
            line_count: log_msg_cnt as usize,
        }))
    }

    /// Calling this function is only possible when the metadata already has been
    /// created.
    /// It will deliever the content of the file that is requested by line_range.
    ///
    /// Get all lines in a file within the supplied line-range
    /// naive implementation that just reads all slots that are involved and drops
    /// everything that is not needed
    pub fn get_entries(
        &self,
        metadata: &GrabMetadata,
        line_range: &LineRange,
    ) -> Result<GrabbedContent, GrabError> {
        if line_range.range.is_empty() {
            return Err(GrabError::InvalidRange {
                range: line_range.clone(),
                context: "Get entries of empty range is invalid".to_string(),
            });
        }
        use std::io::prelude::*;
        let file_part = identify_byte_range(&metadata.slots, line_range).ok_or_else(|| {
            GrabError::InvalidRange {
                range: line_range.clone(),
                context: format!("Error identifying byte range for range {:?}", line_range),
            }
        })?;
        // println!(
        //     "relevant file-part (starts at index {}): lines {}",
        //     file_part.offset_in_file,
        //     file_part.total_lines - file_part.lines_to_skip - file_part.lines_to_drop
        // );

        let mut read_buf = vec![0; file_part.length];
        let mut read_from = fs::File::open(&self.path())
            .map_err(|_| GrabError::IoOperation(format!("Could not open file {:?}", &self.path)))?;
        read_from
            .seek(SeekFrom::Start(file_part.offset_in_file))
            .map_err(|_| {
                GrabError::IoOperation(format!("Could not seek in file {:?}", &self.path))
            })?;

        read_from.read_exact(&mut read_buf).map_err(|_| {
            GrabError::IoOperation(format!("Could not read from file {:?}", &self.path))
        })?;
        let s = unsafe { std::str::from_utf8_unchecked(&read_buf) };
        let all_lines = s.split(|c| c == '\n');
        let lines_minus_end = all_lines.take(file_part.total_lines - file_part.lines_to_drop);
        let pure_lines = lines_minus_end.skip(file_part.lines_to_skip);
        let grabbed_elements = pure_lines
            .map(|s| GrabbedElement {
                source_id: self.source_id.clone(),
                content: s.to_owned(),
                row: None,
                pos: None,
            })
            .collect::<Vec<GrabbedElement>>();
        Ok(GrabbedContent { grabbed_elements })
    }
}

fn count_lines_up_to_last_newline(buffer: &[u8]) -> (u64, usize) {
    if let Some(offset) = buffer.iter().rposition(|&v| v == b'\n') {
        (bytecount::count(buffer, b'\n') as u64, offset)
    } else {
        (0, 0)
    }
}
