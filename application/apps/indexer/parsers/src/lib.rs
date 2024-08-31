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
    /// take a slice of bytes and try to apply a parser. If the parse was
    /// successfull, this will yield  the rest of the slice along with `Some(log_message)`
    ///
    /// if the slice does not have enough bytes, an `Incomplete` error is returned.
    ///
    /// in case we could parse a message but the message was filtered out, `None` is returned
    fn parse<'a>(
        &mut self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(&'a [u8], Option<ParseYield<T>>), Error>;
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

#[derive(Debug, Clone)]
pub enum ParseErrorType {
    Fmt(String),
    Other(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
/// Gives Hint about how this error can be resolved by processor
pub enum ResolveErrorHint {
    /// The message needs to be parsed with SomeIP Parser.
    SomeIP,
}

#[derive(Debug, Clone)]
pub struct ParseLogError {
    pub remain_bytes: Vec<u8>,
    pub error_type: ParseErrorType,
    pub resolve_hint: Option<ResolveErrorHint>,
}

impl ParseLogError {
    pub fn new(
        remain_bytes: Vec<u8>,
        error_type: ParseErrorType,
        resolve_hint: Option<ResolveErrorHint>,
    ) -> Self {
        Self {
            remain_bytes,
            error_type,
            resolve_hint,
        }
    }
}

impl Display for ParseLogError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.error_type {
            ParseErrorType::Other(msg) | ParseErrorType::Fmt(msg) => write!(f, "{msg}"),
        }
    }
}

impl From<std::fmt::Error> for ParseLogError {
    fn from(value: std::fmt::Error) -> Self {
        Self {
            remain_bytes: Vec::new(),
            error_type: ParseErrorType::Fmt(value.to_string()),
            resolve_hint: None,
        }
    }
}

impl std::error::Error for ParseLogError {}

#[derive(Debug, Clone)]
pub struct ToTextResult {
    pub msg: String,
    pub error: Option<ParseLogError>,
}

impl ToTextResult {
    pub fn new(msg: String, error: Option<ParseLogError>) -> Self {
        Self { msg, error }
    }
}

impl<T> From<T> for ToTextResult
where
    T: Display,
{
    fn from(value: T) -> Self {
        Self::new(value.to_string(), None)
    }
}

pub trait LogMessage: Serialize {
    //TODO AAZ: Measure this an remove if rust already optimize the code without it.
    /// Indicates that parsing this struct to text can error.
    const CAN_ERROR: bool;

    /// Serializes a message directly into a Writer
    /// returns the size of the serialized message
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error>;

    /// Get the text representation of this message.
    fn to_text(&self) -> ToTextResult;
}

#[derive(Debug)]
pub enum MessageStreamItem<T: LogMessage> {
    Item(ParseYield<T>),
    Skipped,
    Incomplete,
    Empty,
    Done,
}
