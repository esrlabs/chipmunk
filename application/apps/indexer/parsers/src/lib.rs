#![deny(unused_crate_dependencies)]

use components::Components;
use definitions::{LogRecordOutput, LogRecordWriter, ParseOperationResult, ParserError};
pub mod dlt;
pub mod prelude;
pub mod someip;
pub mod text;

pub enum Parser {
    Dlt(dlt::DltParser),
    SomeIp(someip::SomeipParser),
    Text(text::StringTokenizer),
}

/**
 * NOTE/TODO:
 * Using of the whole enum inside MessageProducer might give performance impact because it's massive.
 * Into MessageProducer we should put exact instances of parsers instead enum-wrapper
 */

impl definitions::Parser for Parser {
    fn parse<'a>(
        &mut self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(usize, Option<LogRecordOutput<'a>>), ParserError> {
        match self {
            Self::Dlt(inst) => inst.parse(input, timestamp),
            Self::SomeIp(inst) => inst.parse(input, timestamp),
            Self::Text(inst) => inst.parse(input, timestamp),
        }
    }
}

pub fn registration<S>(components: &mut Components<S, Parser>) -> Result<(), stypes::NativeError> {
    components.add_parser(dlt::options::Descriptor::default())?;
    components.add_parser(someip::options::Descriptor::default())?;
    components.add_parser(text::options::Descriptor::default())?;
    Ok(())
}
