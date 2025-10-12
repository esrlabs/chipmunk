use std::{collections::VecDeque, fmt, io::Write, mem};

use parsers::Error;
use parsers::LogMessage;
use parsers::ParseYield;
use serde::Serialize;

use super::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
/// Message to return within [`parsers::ParseYield`]
pub struct MockMessage {
    /// Content represents as usize for simplicity
    pub content: usize,
}

impl From<usize> for MockMessage {
    fn from(value: usize) -> Self {
        Self { content: value }
    }
}

impl fmt::Display for MockMessage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.content)
    }
}

impl LogMessage for MockMessage {
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        write!(writer, "{:b}", self.content)?;
        Ok(mem::size_of::<usize>())
    }
}

/// Mock Parser to use in prototyping and unit-tests
pub struct MockParser {
    /// The seeds that will be used to return values on [`Parser::parse()`] calls
    seeds: VecDeque<Result<Vec<MockParseSeed>, Error>>,
}

impl MockParser {
    /// * `seeds`: Seeds items which that will be used to produce return-values on [`Parser::parse()`] calls
    pub fn new(seeds: impl Into<VecDeque<Result<Vec<MockParseSeed>, Error>>>) -> Self {
        Self {
            seeds: seeds.into(),
        }
    }
}

#[derive(Debug)]
/// Used to produce a Parse result item in [`MockParser`]
pub struct MockParseSeed {
    /// Represents how much bytes should be consumed in the given slice in [`Parser::parse()`]
    cosumed: usize,
    /// Parse Yield value to return on [`Parser::parse()`] call
    parse_yeild: Option<ParseYield<MockMessage>>,
}

impl MockParseSeed {
    pub fn new(cosumed: usize, parse_yeild: Option<ParseYield<MockMessage>>) -> Self {
        Self {
            cosumed,
            parse_yeild,
        }
    }
}

impl Parser for MockParser {
    type Output = MockMessage;

    fn parse(
        &mut self,
        _input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseOutput<MockMessage>>, Error> {
        let seed_res = self
            .seeds
            .pop_front()
            .expect("Seeds count must match parse count");

        let seeds = seed_res?;

        Ok(seeds
            .into_iter()
            .map(|seed| ParseOutput::new(seed.cosumed, seed.parse_yeild)))
    }
}

#[test]
fn test_mock_parser() {
    let mut parser = MockParser::new([
        Ok(vec![MockParseSeed::new(1, None)]),
        Ok(vec![MockParseSeed::new(
            2,
            Some(ParseYield::Message(MockMessage::from(1))),
        )]),
        Err(ParserError::Eof),
    ]);

    let parse_result_ok_none = parser.parse(b"ab", None).unwrap().next().unwrap();
    assert_eq!(parse_result_ok_none.consumed, 1);
    assert!(matches!(parse_result_ok_none.message, None));

    let parse_result_ok_val = parser.parse(b"ab", None).unwrap().next().unwrap();
    assert_eq!(parse_result_ok_val.consumed, 2);
    assert!(matches!(
        parse_result_ok_val.message,
        Some(ParseYield::Message(MockMessage { content: 1 }))
    ));

    let parse_result_err = parser.parse(b"ab", None);
    assert!(matches!(parse_result_err, Err(ParserError::Eof)));
}
