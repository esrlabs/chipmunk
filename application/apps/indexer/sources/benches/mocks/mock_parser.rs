use std::{fmt::Display, iter, marker::PhantomData};

use criterion::black_box;
use parsers::{Attachment, LogMessage, Parser};
use serde::Serialize;

/// Empty type used as phantom data with mock parser to indicate that its [`Parser::parse()`]
/// implementation will always return [`iter::once()`].
pub struct IterOnce;

/// Empty type used as phantom data with mock parser to indicate that its [`Parser::parse()`]
/// implementation will always return an iterator with multiple value.
pub struct IterMany;

#[derive(Debug, Clone, Copy)]
pub struct MockParser<T> {
    /// Sets how many times the method [`Parser::parse()`] will be called before it'll return None.
    max_count: usize,
    /// Internal counter to keep track how many times [`Parser::parse()`] has been called.
    counter: usize,
    /// Marker to have multiple implementations for [`Parser`] trait.
    _marker: PhantomData<T>,
}

// This is used in once benchmark only which lead to a warning when this module is
// imported into multiple benchmark.
#[allow(dead_code)]
impl MockParser<IterOnce> {
    /// Creates new instance of the mock parser with the given settings.
    /// This returns [`iter::once()`] on [`Parser::parse()`]
    ///
    /// * `max_count`: Sets how many times the method [`Parser::parse()`] will be called before it'll return None.
    pub const fn new_once(max_count: usize) -> Self {
        Self {
            max_count,
            counter: 0,
            _marker: PhantomData,
        }
    }
}

// This is used in multiple benchmark only which lead to a warning when this module is
// imported into once benchmark.
#[allow(dead_code)]
impl MockParser<IterMany> {
    /// Creates new instance of the mock parser with the given settings.
    /// This returns an iterator with multiple values on [`Parser::parse()`]
    ///
    /// * `max_count`: Sets how many times the method [`Parser::parse()`] will be called before it'll return None.
    pub const fn new_multi(max_count: usize) -> Self {
        Self {
            max_count,
            counter: 0,
            _marker: PhantomData,
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

impl<T> MockParser<T> {
    /// Method to replicate parse behavior with artificial if statements with black boxes to avoid
    /// any uncounted compiler optimization.
    #[inline(never)]
    fn inner_parse(
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
}

// NOTE: Methods within trait implementation have inner non-async function that should never be
// inline and the trait method should be always inline. This reduces the noise in the benchmarks.
impl Parser<MockMessage> for MockParser<IterOnce> {
    /// This will keep returning a valid item result withing an [`iter::once`] until the counter
    /// reaches max count then it will be return [`parsers::Error::Eof`]
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<
        impl Iterator<Item = (usize, Option<parsers::ParseYield<MockMessage>>)>,
        parsers::Error,
    > {
        self.counter += 1;

        let item = Self::inner_parse(self.counter, self.max_count, input, timestamp)?;

        Ok(iter::once(item))
    }
}

// NOTE: Methods within trait implementation have inner non-async function that should never be
// inline and the trait method should be always inline. This reduces the noise in the benchmarks.
impl Parser<MockMessage> for MockParser<IterMany> {
    /// This will keep returning an iterator of multiple valid items until the counter reaches max
    /// count then it will be return [`parsers::Error::Eof`]
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<
        impl Iterator<Item = (usize, Option<parsers::ParseYield<MockMessage>>)>,
        parsers::Error,
    > {
        self.counter += 1;

        const REPEAT: usize = 10;
        let mut res = Vec::with_capacity(black_box(REPEAT));
        for _ in 0..black_box(REPEAT) {
            let item = Self::inner_parse(self.counter, self.max_count, input, timestamp)?;
            res.push(item)
        }

        Ok(res.into_iter())
    }
}
