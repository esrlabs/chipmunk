mod record;

use crate::*;
use stypes::{NativeError, SessionAction};
use thiserror::Error;

pub use record::*;

/// Defines the function type used to construct a parser instance for a session.
///
/// This factory function is stored in the [`Register`] and invoked when a new session
/// is initialized. It produces a parser instance based on the provided session context
/// and configuration fields.
///
/// The return value is a tuple:
/// - [`Parsers`] – An enum-wrapped instance of the constructed parser.
/// - `Option<String>` – A human-readable label that describes the configured parser in context.
///
/// The difference between this label and the one returned by [`CommonDescriptor`] is that
/// this one is **context-aware**. While `CommonDescriptor` may return a general name such as
/// `"DLT parser"`, this factory may return something more specific like
/// `"DLT with fibex /few/fibex.xml"` depending on user configuration or input.
///
/// # Arguments
///
/// * `&SessionAction` – The session action context (e.g., user-triggered session creation).
/// * `&[stypes::Field]` – A list of configuration fields provided by the client or system.
///
/// # Returns
///
/// * `Ok(Some((Parsers, Option<String>)))` – A constructed parser instance with an optional
///   context-specific name for display.
/// * `Ok(None)` – Indicates that no parser should be created.
/// * `Err(NativeError)` – If parser creation fails due to misconfiguration or internal error.
///
/// # Errors
///
/// Returns an `Err(NativeError)` if the parser cannot be created due to invalid configuration,
/// missing required fields, or runtime failure during instantiation.
pub type ParserFactory = fn(
    &SessionAction,
    &[stypes::Field],
) -> Result<Option<(Parsers, Option<String>)>, stypes::NativeError>;

pub type ParseReturnIterator<'a> =
    Result<Box<dyn Iterator<Item = (usize, Option<LogRecordOutput<'a>>)> + 'a>, ParserError>;

#[derive(Error, Debug)]
pub enum ParserError {
    #[error("Unrecoverable error, cannot continue: {0}")]
    Unrecoverable(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Incomplete, not enough data for a message")]
    Incomplete,
    #[error("End of file reached")]
    Eof,
    #[error("{0}")]
    Native(NativeError),
}

impl From<NativeError> for ParserError {
    fn from(err: NativeError) -> Self {
        ParserError::Native(err)
    }
}

/// Parser trait that needs to be implemented for any parser we support
/// in chipmunk
pub trait Parser {
    /// Takes a slice of bytes and try to apply a parser. If it can parse any item of them,
    /// it will return iterator of items each with the consumed bytes count along with `Some(log_message)`
    ///
    /// if the slice does not have enough bytes to parse any item, an [`ParserError`] is returned.
    ///
    /// in case we could parse a message but the message was filtered out, `None` is returned on
    /// that item.
    ///
    /// # Note:
    ///
    /// If the parsers encounter any error while it already has parsed any items, then it must
    /// return those items without the error, then on the next call it can return the errors in
    /// case it was provided with the same slice of bytes.
    fn parse<'a>(&'a mut self, input: &'a [u8], timestamp: Option<u64>) -> ParseReturnIterator<'a>;
}

/// A trait for parsers that extract one item at a time from a byte slice.
///
/// Any type implementing this trait will automatically implement the [`Parser`] trait
/// due to a blanket implementation. This means that such types will support extracting
/// all available items from an input slice by repeatedly calling [`SingleParser::parse_item()`]
/// until no more items can be parsed.
///
/// # Behavior
///
/// - The blanket implementation of [`Parser`] will repeatedly invoke `parse_item()`,
///   extracting as many items as possible.
/// - If `parse_item()` fails on the first call, an error is returned immediately.
/// - If `parse_item()` succeeds, parsing continues until:
///   - The remaining input is too short to parse another item.
///   - `parse_item()` returns an error, which is ignored after the first successful parse.
pub trait SingleParser {
    /// The minimum number of bytes required to parse an item.
    ///
    /// # Notes:
    /// - This value is used to prevent unnecessary parsing attempts when the remaining input
    ///   is too short to contain a valid message.
    /// - The default value (`1`) indicates that the parser has no minimum length requirement.
    const MIN_MSG_LEN: usize = 1;

    /// Parses a single item from the given byte slice.
    ///
    /// in case we could parse a message but the message was filtered out, `None` is returned on
    /// that item.
    fn parse_item<'a>(
        &mut self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(usize, Option<LogRecordOutput<'a>>), ParserError>;
}

/// This blanket implementation repeatedly applies [`SingleParser::parse_item()`] function,
/// extracting as many items as possible from the provided input until no more can be parsed.
impl<P> Parser for P
where
    P: SingleParser,
{
    fn parse<'a>(&'a mut self, input: &'a [u8], timestamp: Option<u64>) -> ParseReturnIterator<'a> {
        let mut slice = input;

        // return early if function errors on first parse call.
        let first_res = self.parse_item(slice, timestamp)?;

        // Otherwise keep parsing and stop on first error, returning the parsed items at the end.
        let iter = std::iter::successors(Some(first_res), move |(consumed, _res)| {
            slice = &slice[*consumed..];

            if slice.len() < P::MIN_MSG_LEN {
                return None;
            }

            self.parse_item(slice, timestamp).ok()
        });

        Ok(Box::new(iter))
    }
}

//TODO AAZ: This could be removed?
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

#[derive(Debug)]
pub enum MessageStreamItem {
    Parsed(ParseOperationResult),
    Skipped,
    Done,
}
