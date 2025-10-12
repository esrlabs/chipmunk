#![deny(unused_crate_dependencies)]
pub mod dlt;
pub mod someip;
pub mod text;
use serde::Serialize;
use std::{
    fmt::{Debug, Display},
    io::Write,
    iter,
};
use thiserror::Error;

extern crate log;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Unrecoverable error, cannot continue: {0}")]
    Unrecoverable(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Incomplete, not enough data for a message")]
    Incomplete,
    #[error("End of file reached")]
    Eof,
}

/// The result of a single parsing step, returned by [`Parser::parse`]
/// or [`SingleParser::parse_item`] calls.
#[derive(Debug)]
pub struct ParseOutput<T> {
    /// The number of bytes consumed from the input for this item.
    pub consumed: usize,

    /// The parsed data, or `None` if the item was filtered out.
    pub message: Option<ParseYield<T>>,
}

impl<T> ParseOutput<T> {
    pub fn new(consumed: usize, message: Option<ParseYield<T>>) -> Self {
        Self { consumed, message }
    }
}

#[derive(Debug)]
pub enum ParseYield<T> {
    Message(T),
    Attachment(Attachment),
    MessageAndAttachment((T, Attachment)),
}

impl<T> From<T> for ParseYield<T> {
    fn from(item: T) -> Self {
        Self::Message(item)
    }
}

/// A trait for parsing structured messages from a byte slice.
///
/// Implementations of this trait define a stateful parser that can be fed
/// byte slices incrementally to produce an iterator of log messages.
///
/// # Notes
///
/// For parsers that produce at most one item per call, consider implementing
/// the [`SingleParser`] trait instead for a simpler interface.
pub trait Parser {
    /// The type of the successfully parsed message.
    type Output: LogMessage;

    /// Attempts to parse messages from the provided byte slice.
    ///
    /// On a successful parse, this returns an iterator of [`ParseOutput`] items.
    /// If a message is parsed but filtered out, the `message` field of the
    /// corresponding [`ParseOutput`] will be `None`.
    ///
    /// # Notes
    ///
    /// If an error is encountered after some items have already been parsed,
    /// the implementation must return the valid items. The error should be
    /// returned on the next call when the problematic slice is provided again.
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseOutput<Self::Output>>, Error>;
}

#[derive(Debug, Clone, Serialize)]
pub struct Attachment {
    pub name: String,
    pub size: usize,
    pub created_date: Option<String>,
    pub modified_date: Option<String>,
    /// The indexes of the message within the original trace (0-based).
    pub messages: Vec<usize>,
    pub data: Vec<u8>,
}

impl Attachment {
    pub fn add_data(&mut self, new_data: &[u8]) {
        self.data.extend_from_slice(new_data);
    }
}

pub trait Collector<T> {
    fn register_message(&mut self, offset: usize, msg: &T);
    fn attachment_indexes(&self) -> Vec<Attachment>;
}

pub trait LineFormat {
    fn format_line(&self) -> String;
}

pub enum ByteRepresentation {
    Owned(Vec<u8>),
    Range((usize, usize)),
}

pub trait LogMessage: Display + Serialize {
    /// Serializes a message directly into a Writer
    /// returns the size of the serialized message
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error>;
}

/// A trait for parsers that extract at most one item per call.
///
/// This trait provides a simpler interface for parsers that do not need to
/// yield an iterator of items from a single input slice. Any type that
/// implements `SingleParser` automatically gets an implementation of [`Parser`]
/// via a blanket implementation.
///
/// The blanket implementation of [`Parser::parse`] will repeatedly call
/// [`SingleParser::parse_item`] on the input, collecting all successfully
/// parsed items into an iterator. If the first call to `parse_item` fails,
/// the error is returned immediately. Any subsequent errors are ignored,
/// terminating the iteration.
pub trait SingleParser {
    /// The type of the successfully parsed message.
    type Output: LogMessage;

    /// The minimum number of bytes required to parse an item.
    ///
    /// # Notes:
    /// - This value is used to prevent unnecessary parsing attempts when the remaining input
    ///   is too short to contain a valid message.
    /// - The default value (`1`) indicates that the parser has no minimum length requirement.
    const MIN_MSG_LEN: usize = 1;

    /// Parses a single item from the start of the given byte slice.
    ///
    /// # Returns
    ///
    /// On success, returns [`ParseOutput`] containing the parsed item and the number of bytes consumed.
    /// If a message is parsed but filtered out, the `message` field of the [`ParseOutput`] will be `None`.
    fn parse_item(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<ParseOutput<Self::Output>, Error>;
}

/// A blanket implementation of [`Parser`] for any type that implements [`SingleParser`].
///
/// This implementation repeatedly calls [`SingleParser::parse_item`], extracting
/// as many items as possible from the input slice until it is exhausted or
/// a parse error occurs after the first item.
impl<P> Parser for P
where
    P: SingleParser,
{
    type Output = P::Output;

    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = ParseOutput<Self::Output>>, Error> {
        let mut slice = input;

        // return early if function errors on first parse call.
        let first_res = self.parse_item(slice, timestamp)?;

        // Otherwise keep parsing and stop on first error, returning the parsed items at the end.
        let iter = iter::successors(Some(first_res), move |out| {
            slice = &slice[out.consumed..];

            if slice.len() < P::MIN_MSG_LEN {
                return None;
            }

            self.parse_item(slice, timestamp).ok()
        });

        Ok(iter)
    }
}
