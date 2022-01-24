use crate::{Error, LogMessage, Parser};
use byteorder::{BigEndian, WriteBytesExt};
use dlt_core::{
    dlt::{self},
    fibex::FibexMetadata,
    filtering::ProcessedDltFilterConfig,
    fmt::FormattableMessage,
    parse::{dlt_consume_msg, dlt_message},
};
use std::{fmt, io::Write, ops::Range};

impl LogMessage for FormattableMessage<'_> {
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        let bytes = self.message.as_bytes();
        let len = bytes.len();
        writer.write_all(&bytes)?;
        Ok(len)
    }
}

#[derive(Debug)]
pub struct RawMessage {
    pub content: Vec<u8>,
}

#[derive(Debug)]
pub struct RangeMessage {
    pub range: Range<usize>,
}

impl fmt::Display for RangeMessage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({:?})", self.range)
    }
}
impl fmt::Display for RawMessage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{:02X?}]", &self.content)
    }
}

impl LogMessage for RangeMessage {
    /// A RangeMessage only has range information and cannot serialize to bytes
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        writer.write_u64::<BigEndian>(self.range.start as u64)?;
        writer.write_u64::<BigEndian>(self.range.end as u64)?;
        Ok(8 + 8)
    }
}

impl LogMessage for RawMessage {
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        let len = self.content.len();
        writer.write_all(&self.content)?;
        Ok(len)
    }
}

#[derive(Default)]
pub struct DltParser<'m> {
    pub filter_config: Option<ProcessedDltFilterConfig>,
    pub fibex_metadata: Option<&'m FibexMetadata>,
    pub with_storage_header: bool,
}

#[derive(Default)]
pub struct DltRangeParser {
    pub with_storage_header: bool,
    offset: usize,
}

pub struct DltRawParser {
    pub with_storage_header: bool,
}

impl DltRawParser {
    pub fn new(with_storage_header: bool) -> Self {
        Self {
            with_storage_header,
        }
    }
}

impl DltRangeParser {
    pub fn new(with_storage_header: bool) -> Self {
        Self {
            with_storage_header,
            offset: 0,
        }
    }
}

impl<'m> DltParser<'m> {
    pub fn new(
        filter_config: Option<ProcessedDltFilterConfig>,
        fibex_metadata: Option<&'m FibexMetadata>,
        with_storage_header: bool,
    ) -> Self {
        Self {
            filter_config,
            fibex_metadata,
            with_storage_header,
        }
    }
}

impl<'m> Parser<FormattableMessage<'m>> for DltParser<'m> {
    fn parse<'b>(
        &mut self,
        input: &'b [u8],
        timestamp: Option<u64>,
    ) -> Result<(&'b [u8], Option<FormattableMessage<'m>>), Error> {
        match dlt_message(input, self.filter_config.as_ref(), self.with_storage_header)
            .map_err(|e| Error::Parse(format!("{}", e)))?
        {
            (rest, dlt_core::parse::ParsedMessage::FilteredOut(_n)) => Ok((rest, None)),

            (_, dlt_core::parse::ParsedMessage::Invalid) => {
                Err(Error::Parse("Invalid parse".to_owned()))
            }
            (rest, dlt_core::parse::ParsedMessage::Item(i)) => {
                let msg_with_storage_header = if i.storage_header.is_some() {
                    i
                } else {
                    i.add_storage_header(
                        timestamp.map(|time| dlt::DltTimeStamp::from_ms(time as u64)),
                    )
                };
                let msg = FormattableMessage {
                    message: msg_with_storage_header,
                    fibex_metadata: self.fibex_metadata,
                    options: None,
                };
                Ok((rest, Some(msg)))
            }
        }
    }
}

impl Parser<RangeMessage> for DltRangeParser {
    fn parse<'b>(
        &mut self,
        input: &'b [u8],
        _timestamp: Option<u64>,
    ) -> Result<(&'b [u8], Option<RangeMessage>), Error> {
        let (rest, consumed) =
            dlt_consume_msg(input).map_err(|e| Error::Parse(format!("{}", e)))?;
        let msg = consumed.map(|c| {
            self.offset += c as usize;
            RangeMessage {
                range: Range {
                    start: self.offset,
                    end: self.offset + c as usize,
                },
            }
        });
        Ok((rest, msg))
    }
}

impl Parser<RawMessage> for DltRawParser {
    fn parse<'b>(
        &mut self,
        input: &'b [u8],
        _timestamp: Option<u64>,
    ) -> Result<(&'b [u8], Option<RawMessage>), Error> {
        let (rest, consumed) =
            dlt_consume_msg(input).map_err(|e| Error::Parse(format!("{}", e)))?;
        let msg = consumed.map(|c| RawMessage {
            content: Vec::from(&input[0..c as usize]),
        });
        Ok((rest, msg))
    }
}

pub struct StringTokenizer;

#[derive(Debug, PartialEq)]
pub struct StringMessage {
    content: String,
}

impl fmt::Display for StringMessage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.content)
    }
}

impl LogMessage for StringMessage {
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        let len = self.content.len();
        writer.write_all(self.content.as_bytes())?;
        Ok(len)
    }
}

impl Parser<StringMessage> for StringTokenizer {
    fn parse<'b>(
        &mut self,
        input: &'b [u8],
        _timestamp: Option<u64>,
    ) -> Result<(&'b [u8], Option<StringMessage>), Error> {
        // TODO: support non-utf8 encodings
        use memchr::memchr;
        if input.is_empty() {
            return Ok((input, None));
        }
        if let Some(msg_size) = memchr(b'\n', input) {
            let content = String::from_utf8_lossy(&input[..msg_size]);
            let string_msg = StringMessage {
                content: content.to_string(),
            };
            Ok((&input[msg_size + 1..], Some(string_msg)))
        } else {
            Ok((
                input,
                Some(StringMessage {
                    content: String::new(),
                }),
            ))
        }
    }
}

#[test]
fn test_string_tokenizer() {
    let mut parser = StringTokenizer;
    let content = b"hello\nworld\n";
    let (rest_1, first_msg) = parser.parse(content, None).unwrap();
    assert_eq!("hello", first_msg.unwrap().content);
    println!("rest_1 = {:?}", String::from_utf8_lossy(rest_1));
    let (rest_2, second_msg) = parser.parse(rest_1, None).unwrap();
    assert_eq!("world", second_msg.unwrap().content);
    let (rest_3, third_msg) = parser.parse(rest_2, None).unwrap();
    println!("rest_3 = {:?}", String::from_utf8_lossy(rest_3));
    assert_eq!(None, third_msg);
}
