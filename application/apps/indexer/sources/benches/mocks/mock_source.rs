use std::iter;

use async_trait::async_trait;
use sources::{ByteSource, ReloadInfo};

#[derive(Debug, Clone)]
pub struct MockByteSource {
    /// Represent the bytes that will be repeated to fill the internal buffer
    data_sample: u8,
    /// Sets how many bytes will be loaded into the internal buffer on each
    /// [`ByteSource::reload()`] call.
    load_amount: usize,
    /// The internal buffer
    buffer: Vec<u8>,
}

impl MockByteSource {
    /// Creates a new instant of [`MockByteSource`]
    ///
    /// * `data_sample`: Represent the bytes that will be repeated to fill the internal buffer
    /// * `load_amount`: Sets how many bytes will be loaded into the internal buffer on
    /// each [`ByteSource::reload()`] call.
    pub fn new(data_sample: u8, load_amount: usize) -> Self {
        Self {
            data_sample,
            load_amount,
            buffer: Vec::new(),
        }
    }
}

#[async_trait]
impl ByteSource for MockByteSource {
    fn consume(&mut self, offset: usize) {
        self.buffer
            .truncate(self.buffer.len().checked_sub(offset).unwrap())
    }

    fn current_slice(&self) -> &[u8] {
        &self.buffer
    }

    fn len(&self) -> usize {
        self.buffer.len()
    }

    async fn reload(
        &mut self,
        _filter: Option<&sources::SourceFilter>,
    ) -> Result<Option<sources::ReloadInfo>, sources::Error> {
        self.buffer
            .extend(iter::repeat(self.data_sample).take(self.load_amount));

        let info = ReloadInfo::new(self.load_amount, self.len(), 0, None);

        Ok(Some(info))
    }
}
