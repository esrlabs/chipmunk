use std::{fmt, io::Write};

use serde::Serialize;
use thiserror::Error;

pub const COLUMN_SENTINAL: char = '\u{0004}';

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
}

#[derive(Debug)]
pub enum ParseYield {
    Message(LogMessage),
    Attachment(Attachment),
    MessageAndAttachment((LogMessage, Attachment)),
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
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<Vec<(usize, Option<ParseYield>)>, ParserError>;
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

#[derive(Debug)]
pub enum LogMessage {
    Raw(Vec<u8>),
    PlainText(String),
    Columns(Vec<String>),
}

impl LogMessage {
    pub fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        match self {
            Self::PlainText(msg) => writer.write(msg.as_bytes()),
            Self::Columns(columns) => {
                writer.write(columns.join(&COLUMN_SENTINAL.to_string()).as_bytes())
            }
            Self::Raw(raw) => writer.write(&raw),
        }
    }
}

impl fmt::Display for LogMessage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::PlainText(msg) => write!(f, "{}", msg),
            Self::Columns(columns) => write!(f, "{}", columns.join(";")),
            Self::Raw(raw) => write!(f, "[{:02X?}]", raw),
        }
    }
}

impl From<LogMessage> for ParseYield {
    fn from(msg: LogMessage) -> Self {
        ParseYield::Message(msg)
    }
}

#[derive(Debug)]
pub enum MessageStreamItem {
    Item(ParseYield),
    Skipped,
    Incomplete,
    Empty,
    Done,
}

/// ### Historical Context
///
/// * The initial parser design was intended to return only one element per parse call.
/// * It was later discovered that in certain scenarios, it is beneficial to return multiple elements if they are available within a single chunk of data.
/// * As a result, the parser interface was modified to return an iterator instead of a single item.
/// * However, this approach has proven to be overly complex and restrictive, and a simpler vector-based solution is now being considered.
///
/// ---
///
/// ### Rationale for Removing `impl Iterator<Item = (usize, Option<ParseYield<T>>)>`
///
/// Using an iterator for returning collections of messages has been rejected for the following reasons:
///
/// 1. Misalignment with the Parser's Role:
///
///    * A parser is a component that processes a chunk of data and returns fully parsed messages.
///    * Using an iterator is excessive, as the parser always produces a complete set of messages, not a stream of potentially infinite items.
///    * The natural output of a parser is a finite collection of messages, making `Vec` a more suitable container.
///
/// ---
///
/// 2. Improved Memory Management:
///
///    * `Vec` allows for single memory allocation, reducing the risk of fragmentation.
///    * Iterators add overhead through internal state management and additional allocations for each step.
///    * `Vec` provides contiguous memory, which improves cache locality and overall access speed.
///    * Given that message batches are typically small (tens to hundreds of items), the fixed structure of `Vec` is generally more efficient.
///
/// ---
///
/// 3. Preserved Architectural Flexibility:
///
///    * Using an iterator prevents the parser from being boxed as a `Box<dyn Parser>`, limiting the flexibility of the architecture.
///    * Vectors are fully compatible with dynamic objects, simplifying modular testing and isolation of components.
///    * Iterators implicitly create lifetime constraints, complicating the safe sharing of data.
///
/// ---
///
/// 4. Reduced Code Complexity:
///
///    * Vectors are easier to use, test, and extend, as they can be compared directly and modified without reconstructing the iterator.
///    * Code using vectors is typically clearer, more maintainable, and less error-prone.
///    * Iterators in this context add unnecessary complexity without significant benefit.
///
/// ---
///
/// 5. Predictable Processing Flow:
///
///    * Message producers always process the entire batch of messages, making streaming unnecessary.
///    * This simplifies profiling and debugging, as the data lifecycle is more straightforward.
///
/// ---
///
/// ### Conclusion:
///
/// * Using `Vec` instead of iterators results in better performance, simpler code, and greater architectural flexibility.
/// * The iterator approach introduces unnecessary complexity without clear advantages, making it inappropriate for this context.
///
/// Continuously applies the [`parse_fn`] function to the given [`input`] bytes,
/// extracting all possible items until no more can be parsed.
///
/// This function serves as a helper for parsing methods that return only the first
/// successfully parsed item. It repeatedly invokes [`parse_fn`] as long as there
/// are enough bytes remaining in [`input`] to parse another message.
///
/// # Behavior
///
/// - If the first invocation of [`parse_fn`] fails, the function returns an error immediately.
/// - If the first invocation succeeds, parsing continues until either:
///   - There are not enough remaining bytes to parse another message.
///   - [`parse_fn`] returns an error, which will be ignored after the first success.
///
/// # Arguments
///
/// * `input`: A slice of bytes to be parsed.
/// * `timestamp`: An optional timestamp associated with the message.
/// * `min_bytes_count`: The minimum number of bytes likely required to parse a message.
/// * `parse_fn`: A function that attempts to parse a message from a byte slice.
///   - It takes a byte slice and an optional timestamp.
///   - It returns a result containing:
///     - The number of bytes consumed.
///     - An optional parsed item [`ParseYield<T>`].
///   - If parsing fails, it returns an [`ParserError`].
pub fn parse_all<F>(
    input: &[u8],
    timestamp: Option<u64>,
    min_bytes_count: usize,
    mut parse_fn: F,
) -> Result<Vec<(usize, Option<ParseYield>)>, ParserError>
where
    F: FnMut(&[u8], Option<u64>) -> Result<(usize, Option<ParseYield>), ParserError>,
{
    let mut slice = input;
    let mut results = Vec::new();

    // Parsing of the first item should be sensentive to errors
    let (consumed, item) = parse_fn(slice, timestamp)?;
    results.push((consumed, item));

    // Continue parsing until end (or error)
    loop {
        slice = &slice[consumed..];

        if slice.len() < min_bytes_count {
            break;
        }

        match parse_fn(slice, timestamp) {
            Ok((consumed, item)) => {
                results.push((consumed, item));
                if consumed == 0 {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    Ok(results)
}
