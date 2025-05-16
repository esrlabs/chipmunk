#![deny(unused_crate_dependencies)]

use components::Components;
use definitions::{LogRecordWriter, ParseOperationResult, ParserError};
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
    async fn parse<W: LogRecordWriter>(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
        writer: &mut W,
    ) -> Result<ParseOperationResult, ParserError> {
        match self {
            Self::Dlt(inst) => inst.parse(input, timestamp, writer).await,
            Self::SomeIp(inst) => inst.parse(input, timestamp, writer).await,
            Self::Text(inst) => inst.parse(input, timestamp, writer).await,
        }
    }
}

pub fn registration<S>(components: &mut Components<S, Parser>) -> Result<(), stypes::NativeError> {
    components.add_parser(dlt::options::Descriptor::default())?;
    components.add_parser(someip::options::Descriptor::default())?;
    components.add_parser(text::options::Descriptor::default())?;
    Ok(())
}
