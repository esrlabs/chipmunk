use crate::{
    ByteSource, Error as SourceError, ReloadInfo, SourceFilter, 
};
use async_trait::async_trait;
use std::io::{Read, Seek};
use mdf::{read::MdfReader, err::MdfError};
use parsers::mdf::MdfRecordSerializer;

/// A byte source for MDF records.
pub struct MdfRecordByteSource<'a, R: Read + Seek> {
    reader: &'a mut MdfReader<'a, R>,
    group: usize,
    buffer: Vec<u8>
}

impl<'a, R: Read + Seek + Send> MdfRecordByteSource<'a, R> {
    /// Creates a new MDF record byte source.
    ///
    /// # Arguments
    ///
    /// * `reader` - The MDF reader to read records from.
    /// * `group` - The index of the data-group within the MDF file.
    pub fn new(reader: &'a mut MdfReader<'a, R>, group: usize) -> Self {
        MdfRecordByteSource {
            reader,
            group,
            buffer: vec![]
        }
    }
}

#[async_trait]
impl<'a, R: Read + Seek + Send + Sync> ByteSource for MdfRecordByteSource<'a, R> {
    async fn reload(&mut self, _: Option<&SourceFilter>
    ) -> Result<Option<ReloadInfo>, SourceError> {
        loop {
            match self.reader.next_record(self.group) {
                Ok(record) => {
                    let mut bytes = MdfRecordSerializer::to_bytes(record);
                    self.buffer.append(&mut bytes);
                    return Ok(Some(ReloadInfo::new(
                        bytes.len(), 
                        self.buffer.len(), 
                        0, 
                        None)));
                }
                Err(MdfError::FLT) => {
                    continue;
                }
                Err(MdfError::EOF) => {
                    return Ok(None);
                }
                Err(error) => {
                    return Err(SourceError::Unrecoverable(format!("{}", error)));
                }
            }
        }
    }

    fn consume(&mut self, offset: usize) {
        self.buffer.drain(..offset);
    }

    fn current_slice(&self) -> &[u8] {
        &self.buffer
    }

    fn len(&self) -> usize { 
        self.buffer.len()
     }
}
