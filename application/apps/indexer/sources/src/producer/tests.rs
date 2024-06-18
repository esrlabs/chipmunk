mod mock_byte_source;
mod mock_parser;

use parsers::ParseYield;
use tests::mock_parser::*;

use super::*;

#[test]
fn test_place_holder() {
    let mut parser = MockParser::new([Ok(MockResultSeed::new(
        0,
        Some(ParseYield::Message(MockMessage::from(1))),
    ))]);

    assert!(parser.parse(&[b'a'], None).is_ok())
}
