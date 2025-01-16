// TODO this duplicates: application/apps/indexer/addons/text_grep/src/buffer.rs
use bufread::BufReader;
use tokio_util::sync::CancellationToken;
use std::io::{BufRead, Read, Result, Seek, SeekFrom, Error, ErrorKind};

const BIN_READER_CAPACITY: usize = 1024 * 1024;
const BIN_MIN_BUFFER_SPACE: usize = 10 * 1024;

pub struct CancellableBufReader<R> {
    buffer: BufReader<R>,
    cancel: CancellationToken
}

impl<R> CancellableBufReader<R> {
    pub fn new(reader: R, cancel: CancellationToken) -> Self {
        CancellableBufReader {
            buffer: BufReader::new(
                BIN_READER_CAPACITY,
                BIN_MIN_BUFFER_SPACE,
                reader),
            cancel
        }
    }
}

impl<R: Read> Read for CancellableBufReader<R> {
    fn read(&mut self, buffer: &mut [u8]) -> Result<usize> {
        if self.cancel.is_cancelled() {
            return Ok(0);
        }
        
        self.buffer.read(buffer)
    }
}

impl<R: Read> BufRead for CancellableBufReader<R> {
    fn fill_buf(&mut self) -> Result<&[u8]> {
        if self.cancel.is_cancelled() {
            return Ok(&[][..]);
        }
        
        self.buffer.fill_buf()
    }

    fn consume(&mut self, size: usize) {
        if self.cancel.is_cancelled() {
            return;
        }

        self.buffer.consume(size)
    }
}

impl<R: Seek> Seek for CancellableBufReader<R> {
    fn seek(&mut self, pos: SeekFrom) -> Result<u64> {
        if self.cancel.is_cancelled() {
            return Err(Error::from(ErrorKind::NotFound));
        }
        
        self.buffer.seek(pos)
    }
}