// #![deny(unused_crate_dependencies)]

pub mod api;
pub mod dlt;
pub mod prelude;
pub mod someip;
pub mod text;

pub use api::*;

pub enum Parsers {
    DltRaw(dlt::raw::DltRawParser),
    Dlt(dlt::DltParser),
    SomeIp(someip::SomeipParser),
    Text(text::StringTokenizer),
    // NOTE: We can't reference plugins parser directly because of circular
    // references between parsers and plugins_host library.
    // TODO AAZ: This is a workaround until we find a proper solution.
    Plugin(Box<dyn definitions::Parser + Send>),
}

/**
 * NOTE/TODO:
 * Using of the whole enum inside MessageProducer might give performance impact because it's massive.
 * Into MessageProducer we should put exact instances of parsers instead enum-wrapper
 */

impl Parser for Parsers {
    fn parse<'a>(&'a mut self, input: &'a [u8], timestamp: Option<u64>) -> ParseReturnIterator<'a> {
        match self {
            Self::Dlt(inst) => inst.parse(input, timestamp),
            Self::DltRaw(inst) => inst.parse(input, timestamp),
            Self::SomeIp(inst) => inst.parse(input, timestamp),
            Self::Text(inst) => inst.parse(input, timestamp),
            Self::Plugin(inst) => inst.parse(input, timestamp),
        }
    }
}

// TODO: this registration function will fail if some of parser would not be registred. That's wrong.
// If some of parsers are failed, another parsers should still be registred as well
