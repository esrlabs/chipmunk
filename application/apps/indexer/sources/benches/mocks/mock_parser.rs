use std::fmt::Display;

use parsers::{LogMessage, Parser};
use serde::Serialize;

#[derive(Debug, Clone, Copy)]
pub struct MockParser {
    /// Sets how much bytes each call of [`Parser::parse()`] should consume.
    consume: usize,
    /// Sets how many times the method [`Parser::parse()`] will be called before it'll return None.
    max_count: usize,
    /// Internal counter to keep track how many times [`Parser::parse()`] has been called.
    counter: usize,
}

impl MockParser {
    /// Creates new instance of the mock parser with the given settings.
    ///
    /// * `consume`: Sets how much bytes each call of [`Parser::parse()`] should consume.
    /// * `max_count`: Sets how many times the method [`Parser::parse()`] will be called before it'll return None.
    pub fn new(consume: usize, max_count: usize) -> Self {
        Self {
            consume,
            max_count,
            counter: 0,
        }
    }
}

#[derive(Debug, Serialize)]
/// Return type of [`Parser::parse()`] method for [`MockParser`]
pub struct MockMessage {
    content: String,
}

impl Display for MockMessage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.content)
    }
}

impl LogMessage for MockMessage {
    fn to_writer<W: std::io::prelude::Write>(
        &self,
        writer: &mut W,
    ) -> Result<usize, std::io::Error> {
        let len = self.content.len();
        writer.write_all(self.content.as_bytes())?;
        Ok(len)
    }
}

impl MockMessage {
    pub fn new(msg: String) -> Self {
        Self { content: msg }
    }
}

impl From<String> for MockMessage {
    fn from(value: String) -> Self {
        Self::new(value)
    }
}

impl Parser<MockMessage> for MockParser {
    fn parse<'a>(
        &mut self,
        input: &'a [u8],
        _timestamp: Option<u64>,
    ) -> Result<(&'a [u8], Option<parsers::ParseYield<MockMessage>>), parsers::Error> {
        if self.counter >= self.max_count {
            return Err(parsers::Error::Eof);
        }
        self.counter += 1;

        let msg = String::from_utf8_lossy(&input[..self.consume]).to_string();

        Ok((
            &input[..self.consume],
            Some(parsers::ParseYield::Message(msg.into())),
        ))
    }
}
