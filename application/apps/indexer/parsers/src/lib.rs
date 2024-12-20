#![deny(unused_crate_dependencies)]
pub mod dlt;
pub mod someip;
pub mod text;
use serde::Serialize;
use std::{fmt::Display, io::Write};
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

/// Parser trait that needs to be implemented for any parser we support
/// in chipmunk
pub trait Parser<T> {
    /// Takes a slice of bytes and try to apply a parser. If it can parse any item of them,
    /// it will return iterator of items each with the consumed bytes count along with `Some(log_message)`
    ///
    /// if the slice does not have enough bytes to parse any item, an [`Error`] is returned.
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
    ) -> Result<impl Iterator<Item = (usize, Option<ParseYield<T>>)>, Error>;
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

#[derive(Debug)]
pub enum MessageStreamItem<T: LogMessage> {
    Item(ParseYield<T>),
    Skipped,
    Incomplete,
    Empty,
    Done,
}
