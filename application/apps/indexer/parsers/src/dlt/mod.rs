pub mod attachment;
pub mod fmt;

use crate::{
    Error, LogMessage, ParseYield, SingleParser, dlt::fmt::FormattableMessage,
    someip::FibexMetadata as FibexSomeipMetadata,
};
use byteorder::{BigEndian, WriteBytesExt};
use dlt_core::{
    dlt,
    parse::{DltParseError, dlt_consume_msg, dlt_message},
};
pub use dlt_core::{
    dlt::LogLevel,
    fibex::{FibexConfig, FibexMetadata as FibexDltMetadata, gather_fibex_data},
    filtering::{DltFilterConfig, ProcessedDltFilterConfig},
};
use serde::Serialize;
use std::{io::Write, ops::Range};

use self::{attachment::FtScanner, fmt::FormatOptions};

/// The most likely minimal bytes count needed to parse a DLT message.
const MIN_MSG_LEN: usize = 20;

impl LogMessage for FormattableMessage<'_> {
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        let bytes = self.message.as_bytes();
        let len = bytes.len();
        writer.write_all(&bytes)?;
        Ok(len)
    }
}

#[derive(Debug, Serialize)]
pub struct RawMessage {
    pub content: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub struct RangeMessage {
    pub range: Range<usize>,
}

impl std::fmt::Display for RangeMessage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "({:?})", self.range)
    }
}
impl std::fmt::Display for RawMessage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
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
    pub fibex_dlt_metadata: Option<&'m FibexDltMetadata>,
    pub fmt_options: Option<&'m FormatOptions>,
    pub with_storage_header: bool,
    ft_scanner: FtScanner,
    fibex_someip_metadata: Option<&'m FibexSomeipMetadata>,
    offset: usize,
}

#[derive(Default)]
pub struct DltRangeParser {
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
    pub fn new() -> Self {
        Self { offset: 0 }
    }
}

impl<'m> DltParser<'m> {
    pub fn new(
        filter_config: Option<ProcessedDltFilterConfig>,
        fibex_dlt_metadata: Option<&'m FibexDltMetadata>,
        fmt_options: Option<&'m FormatOptions>,
        fibex_someip_metadata: Option<&'m FibexSomeipMetadata>,
        with_storage_header: bool,
    ) -> Self {
        Self {
            filter_config,
            fibex_dlt_metadata,
            with_storage_header,
            fmt_options,
            ft_scanner: FtScanner::new(),
            fibex_someip_metadata,
            offset: 0,
        }
    }
}

impl From<DltParseError> for Error {
    fn from(value: DltParseError) -> Self {
        match value {
            DltParseError::Unrecoverable(e) | DltParseError::ParsingHickup(e) => {
                Error::Parse(e.to_string())
            }
            DltParseError::IncompleteParse { needed: _ } => Error::Incomplete,
        }
    }
}

impl<'m> SingleParser<FormattableMessage<'m>> for DltParser<'m> {
    const MIN_MSG_LEN: usize = MIN_MSG_LEN;

    fn parse_item(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<(usize, Option<ParseYield<FormattableMessage<'m>>>), Error> {
        match dlt_message(input, self.filter_config.as_ref(), self.with_storage_header)? {
            (rest, dlt_core::parse::ParsedMessage::FilteredOut(_n)) => {
                let consumed = input.len() - rest.len();
                self.offset += consumed;
                Ok((consumed, None))
            }
            (_, dlt_core::parse::ParsedMessage::Invalid) => {
                Err(Error::Parse("Invalid parse".to_owned()))
            }
            (rest, dlt_core::parse::ParsedMessage::Item(i)) => {
                let attachment = self.ft_scanner.process(&i);
                let msg_with_storage_header = if i.storage_header.is_some() {
                    i
                } else {
                    i.add_storage_header(timestamp.map(dlt::DltTimeStamp::from_ms))
                };

                let msg = FormattableMessage {
                    message: msg_with_storage_header,
                    fibex_dlt_metadata: self.fibex_dlt_metadata,
                    options: self.fmt_options,
                    fibex_someip_metadata: self.fibex_someip_metadata,
                };
                let consumed = input.len() - rest.len();
                self.offset += consumed;
                let item = (
                    consumed,
                    if let Some(attachment) = attachment {
                        Some(ParseYield::MessageAndAttachment((msg, attachment)))
                    } else {
                        Some(ParseYield::Message(msg))
                    },
                );

                Ok(item)
            }
        }
    }
}

impl SingleParser<RangeMessage> for DltRangeParser {
    const MIN_MSG_LEN: usize = MIN_MSG_LEN;

    fn parse_item(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<(usize, Option<ParseYield<RangeMessage>>), Error> {
        let (rest, consumed) = dlt_consume_msg(input)?;
        let msg = consumed.map(|c| {
            self.offset += c as usize;
            RangeMessage {
                range: Range {
                    start: self.offset,
                    end: self.offset + c as usize,
                },
            }
        });
        let total_consumed = input.len() - rest.len();
        let item = (total_consumed, msg.map(|m| m.into()));

        Ok(item)
    }
}

impl SingleParser<RawMessage> for DltRawParser {
    const MIN_MSG_LEN: usize = MIN_MSG_LEN;

const DLT_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
]);

impl components::Component for DltParser<'_> {
    fn ident() -> stypes::Ident {
        stypes::Ident {
            name: String::from("DLT Parser"),
            desc: String::from("DLT Parser"),
            uuid: DLT_PARSER_UUID,
        }
    }
    fn register(_components: &mut components::Components) -> Result<(), stypes::NativeError> {
        Ok(())
    }
}

impl Parser<RangeMessage> for DltRangeParser {
    fn parse(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<(usize, Option<ParseYield<RawMessage>>), Error> {
        let (rest, consumed) = dlt_consume_msg(input)?;
        let msg = consumed.map(|c| RawMessage {
            content: Vec::from(&input[0..c as usize]),
        });
        let total_consumed = input.len() - rest.len();
        let item = (total_consumed, msg.map(|m| m.into()));

const DLT_RANGE_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x01, 0x02, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
]);

impl components::Component for DltRangeParser {
    fn ident() -> stypes::Ident {
        stypes::Ident {
            name: String::from("DLT Range Parser"),
            desc: String::from("DLT Range Parser"),
            uuid: DLT_RANGE_PARSER_UUID,
        }
    }
    fn register(_components: &mut components::Components) -> Result<(), stypes::NativeError> {
        Ok(())
    }
}

impl Parser<RawMessage> for DltRawParser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = (usize, Option<ParseYield<RawMessage>>)>, Error> {
        parse_all(input, timestamp, MIN_MSG_LEN, |input, timestamp| {
            self.parse_item(input, timestamp)
        })
    }
}

const DLT_RAW_PARSER_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x01, 0x03, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
]);

impl components::Component for DltRawParser {
    fn ident() -> stypes::Ident {
        stypes::Ident {
            name: String::from("DLT Raw Parser"),
            desc: String::from("DLT Raw Parser"),
            uuid: DLT_RAW_PARSER_UUID,
        }
    }
    fn register(_components: &mut components::Components) -> Result<(), stypes::NativeError> {
        Ok(())
    }
}
