// #![deny(unused_crate_dependencies)]

use components::Components;
use definitions::{LogRecordOutput, ParserError};
pub mod dlt;
pub mod prelude;
pub mod someip;
pub mod text;

pub enum Parser {
    DltRaw(dlt::raw::DltRawParser),
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
    ) -> Result<impl Iterator<Item = (usize, Option<LogRecordOutput<'a>>)>, ParserError> {
        match self {
            Self::Dlt(inst) => inst.parse(input, timestamp),
            //TODO AAZ: Fix (Burn) this.
            _ => panic!("Commented out due to design errors"),
            // Self::DltRaw(inst) => inst.parse(input, timestamp),
            // Self::SomeIp(inst) => inst.parse(input, timestamp),
            // Self::Text(inst) => inst.parse(input, timestamp),
        }
    }
}

// TODO: this registration function will fail if some of parser would not be registred. That's wrong.
// If some of parsers are failed, another parsers should still be registred as well
pub fn registration<S>(components: &mut Components<S, Parser>) -> Result<(), stypes::NativeError> {
    components.add_parser(dlt::descriptor::Descriptor::default())?;
    components.add_parser(dlt::raw::descriptor::Descriptor::default())?;
    components.add_parser(someip::descriptor::Descriptor::default())?;
    components.add_parser(text::descriptor::Descriptor::default())?;
    Ok(())
}
