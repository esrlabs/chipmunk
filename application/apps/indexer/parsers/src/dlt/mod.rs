pub mod attachment;
pub mod fmt;
mod options;

use crate::{dlt::fmt::FormattableMessage, someip::FibexMetadata as FibexSomeipMetadata};
use byteorder::{BigEndian, WriteBytesExt};
use dlt_core::{
    dlt,
    parse::{dlt_consume_msg, dlt_message, DltParseError},
};
pub use dlt_core::{
    dlt::LogLevel,
    fibex::{gather_fibex_data, FibexConfig, FibexMetadata as FibexDltMetadata},
    filtering::{DltFilterConfig, ProcessedDltFilterConfig},
};
use serde::Serialize;
use std::{io::Write, ops::Range, sync::Arc};

use self::{attachment::FtScanner, fmt::FormatOptions};
use definitions::*;

/// The most likely minimal bytes count needed to parse a DLT message.
const MIN_MSG_LEN: usize = 20;

impl LogMessage for FormattableMessage {
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
pub struct DltParser {
    pub filter_config: Option<ProcessedDltFilterConfig>,
    pub fibex_dlt_metadata: Option<Arc<FibexDltMetadata>>,
    pub fmt_options: Option<Arc<FormatOptions>>,
    pub with_storage_header: bool,
    ft_scanner: FtScanner,
    fibex_someip_metadata: Option<Arc<FibexSomeipMetadata>>,
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

    fn parse_item(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<(usize, Option<ParseYield<RawMessage>>), ParserError> {
        let (rest, consumed) = dlt_consume_msg(input).map_err(map_dlt_err)?;
        let msg = consumed.map(|c| RawMessage {
            content: Vec::from(&input[0..c as usize]),
        });
        let total_consumed = input.len() - rest.len();
        let item = (total_consumed, msg.map(|m| m.into()));

        Ok(item)
    }
}

impl DltRangeParser {
    pub fn new() -> Self {
        Self { offset: 0 }
    }

    fn parse_item(
        &mut self,
        input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<(usize, Option<ParseYield<RangeMessage>>), ParserError> {
        let (rest, consumed) = dlt_consume_msg(input).map_err(map_dlt_err)?;
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

impl DltParser {
    pub fn new(
        filter_config: Option<ProcessedDltFilterConfig>,
        fibex_dlt_metadata: Option<FibexDltMetadata>,
        fmt_options: Option<FormatOptions>,
        fibex_someip_metadata: Option<FibexSomeipMetadata>,
        with_storage_header: bool,
    ) -> Self {
        Self {
            filter_config,
            fibex_dlt_metadata: fibex_dlt_metadata.map(|md| Arc::new(md)),
            with_storage_header,
            fmt_options: fmt_options.map(|fo| Arc::new(fo)),
            ft_scanner: FtScanner::new(),
            fibex_someip_metadata: fibex_someip_metadata.map(|md| Arc::new(md)),
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
    ) -> Result<(usize, Option<ParseYield<FormattableMessage>>), ParserError> {
        match dlt_message(input, self.filter_config.as_ref(), self.with_storage_header)
            .map_err(map_dlt_err)?
        {
            (rest, dlt_core::parse::ParsedMessage::FilteredOut(_n)) => {
                let consumed = input.len() - rest.len();
                self.offset += consumed;
                Ok((consumed, None))
            }
            (_, dlt_core::parse::ParsedMessage::Invalid) => {
                Err(ParserError::Parse("Invalid parse".to_owned()))
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
                    fibex_dlt_metadata: self.fibex_dlt_metadata.clone(),
                    options: self.fmt_options.clone(),
                    fibex_someip_metadata: self.fibex_someip_metadata.clone(),
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

fn map_dlt_err(err: DltParseError) -> ParserError {
    match err {
        DltParseError::Unrecoverable(e) | DltParseError::ParsingHickup(e) => {
            ParserError::Parse(e.to_string())
        }
        DltParseError::IncompleteParse { needed: _ } => ParserError::Incomplete,
    }
}

impl Parser<FormattableMessage> for DltParser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<Vec<(usize, Option<ParseYield<FormattableMessage>>)>, ParserError> {
        parse_all(input, timestamp, MIN_MSG_LEN, |input, timestamp| {
            self.parse_item(input, timestamp)
        })
    }
}

impl Parser<RangeMessage> for DltRangeParser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<Vec<(usize, Option<ParseYield<RangeMessage>>)>, ParserError> {
        parse_all(input, timestamp, MIN_MSG_LEN, |input, timestamp| {
            self.parse_item(input, timestamp)
        })
    }
}

impl Parser<RawMessage> for DltRawParser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<Vec<(usize, Option<ParseYield<RawMessage>>)>, ParserError> {
        parse_all(input, timestamp, MIN_MSG_LEN, |input, timestamp| {
            self.parse_item(input, timestamp)
        })
    }
}
