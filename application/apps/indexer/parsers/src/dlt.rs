use crate::{Error, LogMessage, Parser};
use dlt_core::{
    dlt::{self},
    fibex::FibexMetadata,
    filtering::ProcessedDltFilterConfig,
    fmt::FormattableMessage,
    parse::{dlt_consume_msg, dlt_message, forward_to_next_storage_header},
    statistics::dlt_statistic_row_info,
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

pub struct RangeMessage {
    // pub content: Vec<u8>,
    pub range: Range<usize>,
}

impl fmt::Display for RangeMessage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // write!(f, "({:?})[{} bytes]", self.range, self.content.len())
        write!(f, "({:?})", self.range)
    }
}

// impl LogMessage for RangeMessage {
//     fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
//         let len = self.content.len();
//         writer.write_all(&self.content)?;
//         Ok(len)
//     }
// }

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
        let msg = RangeMessage {
            // content: Vec::from(&input[0..consumed as usize]),
            range: Range {
                start: self.offset,
                end: self.offset + consumed as usize,
            },
        };
        self.offset += consumed as usize;
        Ok((rest, Some(msg)))
    }
}
