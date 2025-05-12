#![deny(unused_crate_dependencies)]

use components::Components;
pub mod dlt;
pub mod prelude;
pub mod someip;
pub mod text;

pub enum Parser {
    Dlt(dlt::DltParser),
    SomeIp(someip::SomeipParser),
    Text(text::StringTokenizer),
}

impl definitions::Parser for Parser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<Vec<(usize, Option<definitions::ParseYield>)>, definitions::ParserError> {
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
