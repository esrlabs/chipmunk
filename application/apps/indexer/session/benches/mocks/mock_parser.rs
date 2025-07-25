use std::{iter, marker::PhantomData};

use parsers::{Attachment, LogRecordOutput, ParseReturnIterator, Parser};
use std::hint::black_box;

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

impl<T> MockParser<T> {
    /// Method to replicate parse behavior with artificial if statements with black boxes to avoid
    /// any uncounted compiler optimization.
    #[inline(never)]
    fn inner_parse<'a>(
        counter: usize,
        max_count: usize,
        input: &'a [u8],
        _timestamp: Option<u64>,
    ) -> Result<(usize, Option<LogRecordOutput<'a>>), parsers::ParserError> {
        // Return `Eof` Once the counter reaches max_count.
        if counter >= max_count {
            const ERR: parsers::ParserError = parsers::ParserError::Eof;

            return Err(black_box(ERR));
        }

        // Unnecessary check to convince the compiler that we are using the input.
        if input.is_empty() {
            return Err(black_box(parsers::ParserError::Eof));
        }

        const MSG: &str = "msg";

        // Unnecessary checks to convince the compiler that all return options are possible.
        if black_box(50) > black_box(60) {
            Err(parsers::ParserError::Incomplete)
        } else if black_box(50) > black_box(0) {
            // Only this value will be always returned if the calls counter still smaller than
            // the max value.
            Ok((
                black_box(input.len()),
                Some(LogRecordOutput::Message(black_box(MSG).into())),
            ))
        } else if black_box(20) > black_box(30) {
            Ok((
                black_box(input.len()),
                Some(LogRecordOutput::Attachment(Attachment {
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
                Some(LogRecordOutput::Multiple(vec![
                    LogRecordOutput::Message(black_box(MSG).into()),
                    LogRecordOutput::Attachment(Attachment {
                        size: black_box(10),
                        name: String::from(black_box(MSG)),
                        data: Vec::new(),
                        messages: Vec::new(),
                        created_date: None,
                        modified_date: None,
                    }),
                ])),
            ))
        }
    }
}

// NOTE: Methods within trait implementation have inner non-async function that should never be
// inline and the trait method should be always inline. This reduces the noise in the benchmarks.
impl Parser for MockParser<IterOnce> {
    /// This will keep returning a valid item result withing an [`iter::once`] until the counter
    /// reaches max count then it will be return [`parsers::Error::Eof`]
    fn parse<'a>(&mut self, input: &'a [u8], timestamp: Option<u64>) -> ParseReturnIterator<'a> {
        self.counter += 1;

        let item = Self::inner_parse(self.counter, self.max_count, input, timestamp)?;

        Ok(Box::new(iter::once(item)))
    }
}

// NOTE: Methods within trait implementation have inner non-async function that should never be
// inline and the trait method should be always inline. This reduces the noise in the benchmarks.
impl Parser for MockParser<IterMany> {
    /// This will keep returning an iterator of multiple valid items until the counter reaches max
    /// count then it will be return [`parsers::Error::Eof`]
    fn parse<'a>(&mut self, input: &'a [u8], timestamp: Option<u64>) -> ParseReturnIterator<'a> {
        self.counter += 1;

        if self.counter >= self.max_count {
            const ERR: parsers::ParserError = parsers::ParserError::Eof;

            return Err(black_box(ERR));
        }

        const REPEAT: usize = 10;
        let mut counter = 0;
        let iter = iter::from_fn(move || {
            counter += 1;
            if counter < black_box(REPEAT) {
                Self::inner_parse(self.counter, self.max_count, input, timestamp).ok()
            } else {
                None
            }
        });
        black_box(Ok(res))
    }
}
