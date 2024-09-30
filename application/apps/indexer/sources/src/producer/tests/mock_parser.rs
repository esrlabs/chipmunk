use std::{collections::VecDeque, fmt, io::Write, mem, usize};

use parsers::Error;
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
    /// The seeds that will be used to return value on [`Parser::parse()`] calls
    seeds: VecDeque<Result<MockParseSeed, Error>>,
}

impl MockParser {
    /// * `seeds`: Seeds items which that will be used to produce return-values on [`Parser::parse()`] calls
    pub fn new(seeds: impl Into<VecDeque<Result<MockParseSeed, Error>>>) -> Self {
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

impl Parser<MockMessage> for MockParser
where
    MockMessage: LogMessage,
{
    fn parse(
        &mut self,
        _input: &[u8],
        _timestamp: Option<u64>,
    ) -> Result<(usize, Option<ParseYield<MockMessage>>), Error> {
        let seed_res = self
            .seeds
            .pop_front()
            .expect("Seeds count must match parse count");

        let seed = seed_res?;

        Ok((seed.cosumed, seed.parse_yeild))
    }
}

#[test]
fn test_mock_parser() {
    let mut parser = MockParser::new([
        Ok(MockParseSeed::new(1, None)),
        Ok(MockParseSeed::new(
            2,
            Some(ParseYield::Message(MockMessage::from(1))),
        )),
        Err(ParserError::Eof),
    ]);

    let parse_result_ok_none = parser.parse(&[b'a', b'b'], None);
    assert!(matches!(parse_result_ok_none, Ok((1, None))));

    let parse_result_ok_val = parser.parse(&[b'a', b'b'], None);
    assert!(matches!(
        parse_result_ok_val,
        Ok((2, Some(ParseYield::Message(MockMessage { content: 1 }))))
    ));

    let parse_result_err = parser.parse(&[b'a', b'b'], None);
    assert!(matches!(parse_result_err, Err(ParserError::Eof)));
}
