pub mod descriptor;

use super::{MIN_MSG_LEN, map_dlt_err};
use crate::*;
pub use descriptor::*;
use dlt_core::parse::dlt_consume_msg;
pub use dlt_core::{
    dlt::LogLevel,
    fibex::{FibexConfig, FibexMetadata as FibexDltMetadata, gather_fibex_data},
    filtering::{DltFilterConfig, ProcessedDltFilterConfig},
};

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
        Ok((total_consumed, msg))
    }
}

impl SingleParser for DltRawParser {
    const MIN_MSG_LEN: usize = MIN_MSG_LEN;

    fn parse_item<'a>(
        &mut self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(usize, Option<LogRecordOutput<'a>>), ParserError> {
        let (consumed, data) = self.parse_item(input, timestamp)?;
        Ok((consumed, data.map(LogRecordOutput::Raw)))
    }
}
