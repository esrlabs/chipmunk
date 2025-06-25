pub mod attachment;
pub mod descriptor;
pub mod fmt;
pub mod raw;

use self::{attachment::FtScanner, fmt::FormatOptions};
use crate::{dlt::fmt::FormattableMessage, someip::FibexMetadata as FibexSomeipMetadata};
use definitions::*;
use dlt_core::{
    dlt,
    parse::{DltParseError, dlt_message},
};
pub use dlt_core::{
    dlt::LogLevel,
    fibex::{FibexConfig, FibexMetadata as FibexDltMetadata, gather_fibex_data},
    filtering::{DltFilterConfig, ProcessedDltFilterConfig},
};
use serde::Serialize;
use stypes::{NativeError, NativeErrorKind, Severity};

/// The most likely minimal bytes count needed to parse a DLT message.
const MIN_MSG_LEN: usize = 20;

#[derive(Debug, Serialize)]
pub struct RawMessage {
    pub content: Vec<u8>,
}

impl std::fmt::Display for RawMessage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{:02X?}]", &self.content)
    }
}

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

impl SingleParser for DltParser {
    const MIN_MSG_LEN: usize = MIN_MSG_LEN;

    fn parse_item<'a>(
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
}

fn to_native_cfg_err<S: ToString>(msg: S) -> NativeError {
    NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::Configuration,
        message: Some(msg.to_string()),
    }
}
