use crate::{Error, LogMessage, ParseYield, Parser};
use std::{fmt, fmt::Display, io::Write};
use serde::Serialize;
use nom::{
    bytes::streaming::take,
    combinator::map,
    number::streaming::be_u64,
    sequence::tuple,
};
use mdf::{
    event::MdfEventBuilder, 
    meta::MdfDataGroupMeta, 
    read::record::MdfRecord,
    err::MdfError,
};

/// A parser for MDF log messages.
pub struct MdfLogMessageParser<'a>  {
    builder: MdfEventBuilder<'a> 
}

impl<'a> MdfLogMessageParser<'a> {
    /// Creates a new MDF log message.
    ///
    /// # Arguments
    ///
    /// * `group` - The meta-info of the data-group within the MDF file.
    pub fn new(group: &'a MdfDataGroupMeta) -> Self {
        MdfLogMessageParser {
            builder: MdfEventBuilder::new(group)
        }
    }
}

unsafe impl<'a> Send for MdfLogMessageParser<'a> {}
unsafe impl<'a> Sync for MdfLogMessageParser<'a> {}

impl<'a> Parser<MdfLogMessage> for MdfLogMessageParser<'a> {
    fn parse<'b>(
        &mut self,
        input: &'b [u8],
        _timestamp: Option<u64>,
    ) -> Result<(&'b [u8], Option<ParseYield<MdfLogMessage>>), Error> {
        let (rest, record) = MdfRecordSerializer::from_bytes(input)?;
        match self.builder.consume_record(record) {
            Ok(event) => {
                Ok((
                    rest,
                    Some(ParseYield::from(MdfLogMessage::from(
                        format!("{}", event),
                        event.payload.to_vec(),
                    ))),
                ))
            }
            Err(MdfError::NED) => {
                Ok((rest, None))
            }
            Err(MdfError::UNK(_)) => {
                Ok((rest, None))
            }
            Err(error) => {
                Err(Error::Parse(format!("{}", error)))
            }
        }
    }
}

/// Represents a MDF log message.
#[derive(Debug, Serialize)]
pub struct MdfLogMessage {
    description: String,
    bytes: Vec<u8>,
}

impl MdfLogMessage {
    /// Creates a new log message for the given values.
    pub fn from(description: String, bytes: Vec<u8>) -> Self {
        MdfLogMessage { description, bytes }
    }
}

impl LogMessage for MdfLogMessage {
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        writer.write_all(&self.bytes)?;
        Ok(self.bytes.len())
    }
}

impl Display for MdfLogMessage {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.description,)
    }
}

/// MDF record serializer. 
pub struct MdfRecordSerializer {}

impl MdfRecordSerializer {
    /// Serializes the given record to bytes.
    pub fn to_bytes(mut record: MdfRecord) -> Vec<u8> {
        let mut buffer: Vec<u8> = vec![];

        buffer.append(&mut record.record_id.to_be_bytes().to_vec());
        buffer.append(&mut (record.record_index as u64).to_be_bytes().to_vec());
        buffer.append(&mut (record.data.len() as u64).to_be_bytes().to_vec());
        buffer.append(&mut record.data);

        buffer
    }

    /// Deserializes a record from the given bytes.
    pub fn from_bytes(input: &[u8]) -> Result<(&[u8], MdfRecord), Error>  {
        let (input, (id, index, length)) = tuple((be_u64, be_u64, be_u64))(input)?;
    
        let result = Ok(map(
            take(length as usize),
            |data: &[u8]| MdfRecord {
                record_id: id,
                record_index: index as usize,
                data: data.to_vec()
            },
        )(input)?);

        result
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_mdf_record_serializer() {
        let record = MdfRecord {
            record_id: 1,
            record_index: 2,
            data: [0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18].to_vec(),
        };

        let bytes = MdfRecordSerializer::to_bytes(record);
        assert_eq!(bytes,
            [
                // id
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
                // index
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 
                // len
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 
                // data
                0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18
            ].to_vec()
        );

        let (rest, result) = MdfRecordSerializer::from_bytes(&bytes).expect("record");

        assert!(rest.is_empty());
        assert_eq!{
            MdfRecord {
                record_id: 1,
                record_index: 2,
                data: [0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18].to_vec(),
            },
            result
        }
    }
}
