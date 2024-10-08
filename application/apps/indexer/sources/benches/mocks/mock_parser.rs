use std::{fmt::Display, iter};

use criterion::black_box;
use parsers::{Attachment, LogMessage, Parser};
use serde::Serialize;

#[derive(Debug, Clone, Copy)]
pub struct MockParser {
    /// Sets how many times the method [`Parser::parse()`] will be called before it'll return None.
    max_count: usize,
    /// Internal counter to keep track how many times [`Parser::parse()`] has been called.
    counter: usize,
}

impl MockParser {
    /// Creates new instance of the mock parser with the given settings.
    /// * `max_count`: Sets how many times the method [`Parser::parse()`] will be called before it'll return None.
    pub const fn new(max_count: usize) -> Self {
        Self {
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

// NOTE: Methods within trait implementation have inner non-async function that should never be
// inline and the trait method should be always inline. This reduces the noise in the benchmarks.
impl Parser<MockMessage> for MockParser {
    /// This will keep returning a valid item result until the counter reaches max count then it
    /// will be return [`parsers::Error::Eof`]
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<
        impl Iterator<Item = (usize, Option<parsers::ParseYield<MockMessage>>)>,
        parsers::Error,
    > {
        #[inline(never)]
        fn inner(
            counter: usize,
            max_count: usize,
            input: &[u8],
            _timestamp: Option<u64>,
        ) -> Result<(usize, Option<parsers::ParseYield<MockMessage>>), parsers::Error> {
            // Return `Eof` Once the counter reaches max_count.
            if counter >= max_count {
                const ERR: parsers::Error = parsers::Error::Eof;

                return Err(criterion::black_box(ERR));
            }

            // Unnecessary check to convince the compiler that we are using the input.
            if input.is_empty() {
                return Err(black_box(parsers::Error::Eof));
            }

            const MSG: &str = "msg";

            // Unnecessary checks to convince the compiler that all return options are possible.
            if black_box(50) > black_box(60) {
                Err(parsers::Error::Incomplete)
            } else if black_box(50) > black_box(0) {
                // Only this value will be always returned if the calls counter still smaller than
                // the max value.
                Ok((
                    black_box(input.len()),
                    Some(parsers::ParseYield::Message(MockMessage {
                        content: black_box(MSG).into(),
                    })),
                ))
            } else if black_box(20) > black_box(30) {
                Ok((
                    black_box(input.len()),
                    Some(parsers::ParseYield::Attachment(Attachment {
                        size: black_box(10),
                        name: String::from(black_box(MSG)),
                        data: Vec::new(),
                        messages: Vec::new(),
                        created_date: None,
                        modified_date: None,
                    })),
                ))
            } else {
                Ok((
                    black_box(input.len()),
                    Some(parsers::ParseYield::MessageAndAttachment((
                        MockMessage {
                            content: black_box(MSG).into(),
                        },
                        Attachment {
                            size: black_box(10),
                            name: String::from(black_box(MSG)),
                            data: Vec::new(),
                            messages: Vec::new(),
                            created_date: None,
                            modified_date: None,
                        },
                    ))),
                ))
            }
        }

        self.counter += 1;

        let item = inner(self.counter, self.max_count, input, timestamp)?;

        Ok(iter::once(item))
    }
}
