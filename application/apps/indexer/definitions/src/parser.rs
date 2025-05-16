use crate::*;
use stypes::NativeError;
use thiserror::Error;

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
#[allow(async_fn_in_trait)]
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
    /// Returns:
    /// `usize` - consumed bytes
    async fn parse<W: LogRecordWriter>(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
        writer: &mut W,
    ) -> Result<ParseOperationResult, ParserError>;
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
pub enum MessageStreamItem {
    Parsed(ParseOperationResult),
    Skipped,
    Done,
}

// fn parse_all<F, T>(
//     input: &[u8],
//     timestamp: Option<u64>,
//     min_bytes_count: usize,
//     mut parse_fn: F,
// ) -> Result<impl Iterator<Item = (usize, Option<ParseYield<T>>)> + use<'_, F, T>, Error>
// where
//     F: FnMut(&[u8], Option<u64>) -> Result<(usize, Option<ParseYield<T>>), Error>,
// {
//     let mut slice = input;

//     // return early if function errors on first parse call.
//     let first_res = parse_fn(slice, timestamp)?;

//     // Otherwise keep parsing and stop on first error, returning the parsed items at the end.
//     let iter = iter::successors(Some(first_res), move |(consumed, _res)| {
//         slice = &slice[*consumed..];

//         if slice.len() < min_bytes_count {
//             return None;
//         }

//         parse_fn(slice, timestamp).ok()
//     });

//     Ok(iter)
// }
