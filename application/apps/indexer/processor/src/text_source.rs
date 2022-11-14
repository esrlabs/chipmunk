use crate::grabber::{
    identify_byte_range, ByteRange, FilePart, GrabError, GrabMetadata, LineRange, Slot,
};
use buf_redux::{policy::MinBuffered, BufReader as ReduxReader};
use indexer_base::progress::ComputationResult;
use log::{error, debug};
use std::{
    fs,
    io::{Read, SeekFrom},
    ops::RangeInclusive,
    path::{Path, PathBuf},
};
use tokio_util::sync::CancellationToken;

const REDUX_READER_CAPACITY: usize = 1024 * 32;
const REDUX_MIN_BUFFER_SPACE: usize = 10 * 1024;

#[derive(Debug)]
pub struct TextFileSource {
    path: PathBuf,
}

impl TextFileSource {
    pub fn new(p: &Path) -> Self {
        Self {
            path: PathBuf::from(p),
        }
    }
}

impl TextFileSource {
    pub fn contains_text(path: &Path) -> Result<bool, GrabError> {
        let chunk_size = 100 * 1024usize;
        let mut f = fs::File::open(path)
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
        let input_file_size = std::fs::metadata(self.path())
            .map_err(|e| {
                GrabError::Config(format!("Could not determine size of input file: {}", e))
            })?
            .len();
        Ok(input_file_size)
    }

    /// Updates metadata for the related file. The file will be read from
    /// the recent position to the end.
    ///
    /// Optionally takes existing related metadata and extends it with
    /// recently detected data. If metadata isn't provided, it will be
    /// generated and the file will be read from the beginning.
    ///
    /// Returning updated/generated metadata and range of recently detected
    /// lines.
    ///
    /// Optionally takes cancellation token to interrupt operation.
    ///
    /// #Errors
    /// In case of cancellation will return error GrabError::Interrupted
    pub fn from_file(
        &mut self,
        base: Option<GrabMetadata>,
        shutdown_token: Option<CancellationToken>,
    ) -> Result<(ComputationResult<GrabMetadata>, Option<RangeInclusive<u64>>), GrabError> {
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
        let (mut slots, (mut byte_offset, mut log_msg_cnt)) = if let Some(base) = base {
            let last = if let Some(last) = base.slots.last() {
                (last.bytes.end() + 1, last.lines.end() + 1)
            } else {
                (0, 0)
            };
            (base.slots, last)
        } else {
            (Vec::<Slot>::new(), (0, 0))
        };
        let from = log_msg_cnt;
        let mut f = fs::File::open(&self.path)
            .map_err(|_| GrabError::IoOperation(format!("Could not open file {:?}", &self.path)))?;
        f.seek(SeekFrom::Start(byte_offset)).map_err(|_| {
            GrabError::IoOperation(format!(
                "Could not seek file {:?} to {}",
                &self.path, byte_offset
            ))
        })?;
        let mut reader = ReduxReader::with_capacity(REDUX_READER_CAPACITY, f)
            .set_policy(MinBuffered(REDUX_MIN_BUFFER_SPACE));
        let mut pending: Option<Slot> = None;
        loop {
            if let Some(shutdown_token) = &shutdown_token {
                if shutdown_token.is_cancelled() {
                    return Ok((ComputationResult::Stopped, None));
                }
            }
            match reader.fill_buf() {
                Ok(content) => {
                    if content.is_empty() {
                        // everything was processed
                        break;
                    }
                    let (nl, offset_last_newline) = count_lines_up_to_last_newline(content);
                    let (slot, consumed, processed_lines) = if nl == 0 {
                        let consumed = content.len() as u64;
                        // we hit a very long line that exceeds our read buffer
                        // in this case we should wait for next chunk of data or
                        // end of file
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
                    let slot = if let Some(pending) = pending.take() {
                        Slot {
                            bytes: ByteRange::from(pending.bytes.start()..=slot.bytes.end()),
                            lines: LineRange::from(pending.lines.start()..=slot.lines.end()),
                        }
                    } else {
                        slot
                    };
                    if nl == 0 {
                        pending = Some(slot);
                    } else {
                        slots.push(slot);
                        log_msg_cnt += processed_lines;
                    }
                    reader.consume(consumed as usize);
                    byte_offset += consumed;
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
        if let Some(slot) = pending.take() {
            // In case if "long" line was last, we add it with the end of file
            slots.push(slot);
        }
        let processed = if log_msg_cnt != from {
            Some(RangeInclusive::new(from, log_msg_cnt - 1))
        } else {
            None
        };
        Ok((
            ComputationResult::Item(GrabMetadata {
                slots,
                line_count: log_msg_cnt as usize,
            }),
            processed,
        ))
    }

    pub fn read_file_segment(
        &self,
        metadata: &GrabMetadata,
        line_range: &LineRange,
    ) -> Result<(Vec<u8>, FilePart), GrabError> {
        if line_range.range.is_empty() {
            return Err(GrabError::InvalidRange {
                range: line_range.clone(),
                context: "Get entries of empty range is invalid".to_string(),
            });
        }
        use std::io::prelude::*;
        let file_part = identify_byte_range(&metadata.slots, line_range).ok_or_else(|| {
            error!("Error identifying byte range for range {:?}", line_range);
            debug!("Available slots: {:?}", metadata.slots);
            GrabError::InvalidRange {
                range: line_range.clone(),
                context: format!("Error identifying byte range for range {:?}", line_range),
            }
        })?;
        let mut read_buf = vec![0; file_part.length];
        let mut read_from = fs::File::open(self.path())
            .map_err(|_| GrabError::IoOperation(format!("Could not open file {:?}", &self.path)))?;
        read_from
            .seek(SeekFrom::Start(file_part.offset_in_file))
            .map_err(|_| {
                GrabError::IoOperation(format!("Could not seek in file {:?}", &self.path))
            })?;

        read_from.read_exact(&mut read_buf).map_err(|_| {
            GrabError::IoOperation(format!("Could not read from file {:?}", &self.path))
        })?;
        Ok((read_buf, file_part))
    }

    pub fn clear_lines<'a>(
        &self,
        read_buf: &'a [u8],
        file_part: &FilePart,
    ) -> Result<Vec<&'a str>, GrabError> {
        let s = unsafe { std::str::from_utf8_unchecked(read_buf) };
        let all_lines = s.split(|c| c == '\n');
        let lines_minus_end = all_lines.take(file_part.total_lines - file_part.lines_to_drop);
        let pure_lines = lines_minus_end
            .skip(file_part.lines_to_skip)
            .collect::<Vec<&str>>();
        Ok(pure_lines)
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
    ) -> Result<Vec<String>, GrabError> {
        let (read_buf, file_part) = self.read_file_segment(metadata, line_range)?;
        Ok(self
            .clear_lines(&read_buf, &file_part)?
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<String>>())
    }

    pub fn write_to<W: std::io::Write>(
        &self,
        writer: &mut W,
        metadata: &GrabMetadata,
        line_range: &LineRange,
    ) -> Result<(), GrabError> {
        let (read_buf, file_part) = self.read_file_segment(metadata, line_range)?;
        writer
            .write(
                self.clear_lines(&read_buf, &file_part)?
                    .join("\n")
                    .as_bytes(),
            )
            .map_err(|e| GrabError::IoOperation(format!("Could not write into file {:?}", e)))?;
        Ok(())
    }
}

fn count_lines_up_to_last_newline(buffer: &[u8]) -> (u64, usize) {
    if let Some(offset) = buffer.iter().rposition(|&v| v == b'\n') {
        (bytecount::count(buffer, b'\n') as u64, offset)
    } else {
        (0, 0)
    }
}
