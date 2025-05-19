pub mod attachment;
pub mod fmt;
pub mod options;

use std::io;

use crate::{dlt::fmt::FormattableMessage, someip::FibexMetadata as FibexSomeipMetadata};
// use byteorder::{BigEndian, WriteBytesExt};
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
use stypes::NativeError;
// use std::{io::Write, ops::Range, sync::Arc};

use self::{attachment::FtScanner, fmt::FormatOptions};
use definitions::*;

/// The most likely minimal bytes count needed to parse a DLT message.
const MIN_MSG_LEN: usize = 20;

// #[derive(Debug, Serialize)]
// pub struct RangeMessage {
//     pub range: Range<usize>,
// }

// impl std::fmt::Display for RangeMessage {
//     fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
//         write!(f, "({:?})", self.range)
//     }
// }

#[derive(Debug, Serialize)]
pub struct RawMessage {
    pub content: Vec<u8>,
}

impl std::fmt::Display for RawMessage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{:02X?}]", &self.content)
    }
}

// impl LogMessage for RangeMessage {
//     /// A RangeMessage only has range information and cannot serialize to bytes
//     fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
//         writer.write_u64::<BigEndian>(self.range.start as u64)?;
//         writer.write_u64::<BigEndian>(self.range.end as u64)?;
//         Ok(8 + 8)
//     }
// }

#[derive(Default)]
pub struct DltParser {
    pub filter_config: Option<ProcessedDltFilterConfig>,
    pub fibex_dlt_metadata: Option<FibexDltMetadata>,
    pub fmt_options: Option<FormatOptions>,
    pub with_storage_header: bool,
    ft_scanner: FtScanner,
    fibex_someip_metadata: Option<FibexSomeipMetadata>,
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

    fn parse_item<'a>(
        &mut self,
        input: &'a [u8],
        _timestamp: Option<u64>,
    ) -> Result<(usize, Option<&'a [u8]>), ParserError> {
        let (rest, consumed) = dlt_consume_msg(input).map_err(map_dlt_err)?;
        let msg = consumed.map(|c| &input[0..c as usize]);
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
    ) -> Result<(usize, Option<(FormattableMessage<'_>, Option<Attachment>)>), ParserError> {
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
                    fibex_dlt_metadata: self.fibex_dlt_metadata.as_ref(),
                    options: self.fmt_options.as_ref(),
                    fibex_someip_metadata: self.fibex_someip_metadata.as_ref(),
                };
                let consumed = input.len() - rest.len();
                self.offset += consumed;
                Ok((consumed, Some((msg, attachment))))
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

impl Parser for DltParser {
    fn parse<'a>(
        &mut self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(usize, Option<LogRecordOutput<'a>>), ParserError> {
        let (consumed, data) = self.parse_item(input, timestamp)?;
        Ok((
            consumed,
            data.map(|(msg, attachment)| {
                if let Some(attachment) = attachment {
                    LogRecordOutput::Multiple(vec![
                        LogRecordOutput::String(msg.to_string()),
                        LogRecordOutput::Attachment(attachment),
                    ])
                } else {
                    LogRecordOutput::String(msg.to_string())
                }
            }),
        ))
    }
    fn min_msg_len(&self) -> usize {
        MIN_MSG_LEN
    }
}

// impl Parser for DltParser {
//     async fn parse<W: LogRecordWriter>(
//         &mut self,
//         input: &[u8],
//         timestamp: Option<u64>,
//         writer: &mut W,
//     ) -> Result<ParseOperationResult, ParserError> {
//         async fn write<W: LogRecordWriter>(
//             data: Option<(FormattableMessage<'_>, Option<Attachment>)>,
//             writer: &mut W,
//         ) -> Result<usize, NativeError> {
//             if let Some((msg, attachment)) = data {
//                 writer.write(LogRecordOutput::Str(&msg.to_string())).await?;
//                 if let Some(attachment) = attachment {
//                     writer
//                         .write(LogRecordOutput::Attachment(attachment))
//                         .await?;
//                     Ok(2)
//                 } else {
//                     Ok(1)
//                 }
//             } else {
//                 Ok(0)
//             }
//         }
//         let mut slice = input;
//         // Parsing of the first item should be sensentive to errors
//         let mut total_consumed = 0;
//         let (mut recently_consumed, data) = self.parse_item(slice, timestamp)?;
//         let mut count = write(data, writer).await?;
//         total_consumed += recently_consumed;
//         // Continue parsing until end (or error)
//         loop {
//             println!(
//                 ">>>>>>>>>>>>>>>>>> DLT parser: Slice: {recently_consumed} / {}",
//                 slice.len()
//             );
//             slice = &slice[recently_consumed..];

//             if slice.len() < MIN_MSG_LEN {
//                 break;
//             }

//             match self.parse_item(slice, timestamp) {
//                 Ok((consumed, data)) => {
//                     recently_consumed = consumed;
//                     total_consumed += recently_consumed;
//                     println!(
//                         ">>>>>>>>>>>>>>>>>> DLT parser: consumed: {consumed}/{total_consumed}"
//                     );
//                     count += write(data, writer).await?;
//                     if recently_consumed == 0 {
//                         println!(">>>>>>>>>>>>>>>>>> DLT parser: 0004");
//                         break;
//                     }
//                 }
//                 Err(_) => break,
//             }
//         }
//         println!(">>>>>>>>>>>>>>>>>> DLT parser: 0005");
//         Ok(ParseOperationResult::new(total_consumed, count))
//     }
// }

impl Parser for DltRawParser {
    fn parse<'a>(
        &mut self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(usize, Option<LogRecordOutput<'a>>), ParserError> {
        let (consumed, data) = self.parse_item(input, timestamp)?;
        Ok((consumed, data.map(LogRecordOutput::Raw)))
    }
    fn min_msg_len(&self) -> usize {
        MIN_MSG_LEN
    }
}

// impl<P, T> Parser<T> for P
// where
//     P: SingleParser<T>,
// {
//     fn parse<'a>(
//         &mut self,
//         input: &[u8],
//         timestamp: Option<u64>,
//     ) -> Result<impl Iterator<Item = (usize, LogRecordOutput<'a>)>, ParserError> {
//         let mut slice = input;

//         // return early if function errors on first parse call.
//         let first_res = self.parse_item(slice, timestamp)?;

//         // Otherwise keep parsing and stop on first error, returning the parsed items at the end.
//         let iter = iter::successors(Some(first_res), move |(consumed, _res)| {
//             slice = &slice[*consumed..];

//             if slice.len() < P::MIN_MSG_LEN {
//                 return None;
//             }

//             self.parse_item(slice, timestamp).ok()
//         });

//         Ok(iter)
//     }
// }
