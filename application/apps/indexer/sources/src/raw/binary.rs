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
// pub(crate) const BIN_READER_CAPACITY: usize = 1000;
// pub(crate) const BIN_MIN_BUFFER_SPACE: usize = 500;

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

// impl<R: Read + Send + Seek> StaticByteSource for BinaryByteSource<R> {
//     fn load(&mut self, _filter: Option<&SourceFilter>) -> Result<Option<ReloadInfo>, SourceError> {
//         let content = self
//             .reader
//             .fill_buf()
//             .map_err(|e| SourceError::Unrecoverable(format!("Could not fill buffer: {}", e)))?;
//         if content.is_empty() {
//             trace!("0, Ok(None)");
//             return Ok(None);
//         }
//         let available = content.len();
//         Ok(Some(ReloadInfo::new(available, 0, None)))
//     }
// }

#[async_trait]
impl<R: Read + Send + Sync + Seek> ByteSource for BinaryByteSource<R> {
    async fn reload(
        &mut self,
        _: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        let initial_buf_len = self.reader.buf_len();
        trace!(
            "before: capacity: {} (buf_len: {})",
            self.reader.capacity(),
            initial_buf_len
        );
        let available = {
            let content = self
                .reader
                .fill_buf()
                .map_err(|e| SourceError::Unrecoverable(format!("Could not fill buffer: {}", e)))?;
            content.len()
        };
        let newly_loaded_bytes = if available > initial_buf_len {
            available - initial_buf_len
        } else {
            0
        };
        trace!(
            "after: capacity: {} (newly loaded: {})",
            self.reader.capacity(),
            newly_loaded_bytes
        );
        if available == 0 {
            trace!("0, Ok(None)");
            return Ok(None);
        }
        Ok(Some(ReloadInfo::new(
            newly_loaded_bytes,
            available,
            0,
            None,
        )))
    }

    fn current_slice(&self) -> &[u8] {
        self.reader.buffer()
    }
    fn consume(&mut self, offset: usize) {
        trace!("consume {} bytes", offset);
        self.reader.consume(offset);
    }

    fn len(&self) -> usize {
        self.reader.buf_len()
    }
}
