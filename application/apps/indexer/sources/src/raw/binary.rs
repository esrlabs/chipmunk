use crate::{ByteSource, Error as SourceError, ReloadInfo, SourceFilter};
use async_trait::async_trait;
use buf_redux::{policy::MinBuffered, BufReader as ReduxReader};
use std::io::{BufRead, Read, Seek};

pub struct BinaryByteSource<R>
where
    R: Read + Seek,
{
    reader: ReduxReader<R, MinBuffered>,
}

pub(crate) const BIN_READER_CAPACITY: usize = 10 * 1024 * 1024;
pub(crate) const BIN_MIN_BUFFER_SPACE: usize = 10 * 1024;

impl<R> BinaryByteSource<R>
where
    R: Read + Seek + Unpin,
{
    pub fn new(input: R) -> BinaryByteSource<R> {
        let reader = ReduxReader::with_capacity(BIN_READER_CAPACITY, input)
            .set_policy(MinBuffered(BIN_MIN_BUFFER_SPACE));
        BinaryByteSource { reader }
    }
}

#[async_trait]
impl<R: Read + Send + Seek> ByteSource for BinaryByteSource<R> {
    fn current_slice(&self) -> &[u8] {
        self.reader.buffer()
    }

    async fn reload(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        let content = self
            .reader
            .fill_buf()
            .map_err(|e| SourceError::Unrecoverable(format!("Could not fill buffer: {}", e)))?;
        if content.is_empty() {
            trace!("0, Ok(None)");
            return Ok(None);
        }
        let available = content.len();
        return Ok(Some(ReloadInfo::new(available, 0, None)));
    }

    fn consume(&mut self, offset: usize) {
        self.reader.consume(offset);
    }

    fn len(&self) -> usize {
        self.reader.buf_len()
    }
}
