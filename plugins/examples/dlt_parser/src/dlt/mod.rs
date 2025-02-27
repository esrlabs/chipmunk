pub mod attachment;
pub mod fmt;

use crate::dlt::fmt::FormattableMessage;
use dlt_core::{
    dlt,
    parse::{dlt_message, DltParseError},
};
use dlt_core::{fibex::FibexMetadata as FibexDltMetadata, filtering::ProcessedDltFilterConfig};
use plugins_api::parser::{ParseError, ParseReturn, ParseYield};

use self::{attachment::FtScanner, fmt::FormatOptions};

#[derive(Default)]
pub struct DltParser {
    pub filter_config: Option<ProcessedDltFilterConfig>,
    pub fibex_dlt_metadata: Option<FibexDltMetadata>,
    pub fmt_options: Option<FormatOptions>,
    pub with_storage_header: bool,
    ft_scanner: FtScanner,
}

impl DltParser {
    pub fn new(
        filter_config: Option<ProcessedDltFilterConfig>,
        fibex_dlt_metadata: Option<FibexDltMetadata>,
        fmt_options: Option<FormatOptions>,
        with_storage_header: bool,
    ) -> Self {
        Self {
            filter_config,
            fibex_dlt_metadata,
            with_storage_header,
            fmt_options,
            ft_scanner: FtScanner::new(),
        }
    }
}

fn dlt_error_into_parse(error: DltParseError) -> ParseError {
    match error {
        DltParseError::Unrecoverable(e) | DltParseError::ParsingHickup(e) => {
            ParseError::Unrecoverable(e)
        }
        DltParseError::IncompleteParse { needed: _ } => ParseError::Incomplete,
    }
}

impl DltParser {
    pub fn parse_line(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<ParseReturn, ParseError> {
        match dlt_message(input, self.filter_config.as_ref(), self.with_storage_header)
            .map_err(dlt_error_into_parse)?
        {
            (rest, dlt_core::parse::ParsedMessage::FilteredOut(_n)) => {
                let consumed = input.len() - rest.len();
                Ok(ParseReturn::new(consumed as u64, None))
            }
            (_, dlt_core::parse::ParsedMessage::Invalid) => {
                Err(ParseError::Parse("Invalid parse".to_owned()))
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
                };
                let consumed = input.len() - rest.len();
                let parse_yld = if let Some(attachment) = attachment {
                    ParseYield::MessageAndAttachment((msg.to_parse_msg(), attachment))
                } else {
                    ParseYield::Message(msg.to_parse_msg())
                };

                let item = ParseReturn::new(consumed as u64, Some(parse_yld));

                Ok(item)
            }
        }
    }
}
