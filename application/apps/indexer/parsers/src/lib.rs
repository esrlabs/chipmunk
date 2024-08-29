#![deny(unused_crate_dependencies)]
pub mod dlt;
pub mod nested_parser;
pub mod someip;
pub mod text;
use nested_parser::ParseRestResolver;
use serde::Serialize;
use std::{convert::Infallible, fmt::Display, io::Write};
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

#[derive(Debug)]
pub enum MessageStreamItem<T: LogMessage> {
    Item(ParseYield<T>),
    Skipped,
    Incomplete,
    Empty,
    Done,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParseLogSeverity {
    Error,
    Warn,
    Info,
}

pub trait ParseLogMsgError {
    fn parse_lossy(self) -> String;
    fn severity(&self) -> ParseLogSeverity;
    fn error_msg(&self) -> String;
}

impl ParseLogMsgError for Infallible {
    fn parse_lossy(self) -> String {
        panic!("Infallible can't be instantiated")
    }

    fn severity(&self) -> ParseLogSeverity {
        panic!("Infallible can't be instantiated")
    }

    fn error_msg(&self) -> String {
        panic!("Infallible can't be instantiated")
    }
}

#[derive(Debug, Clone)]
//TODO AAZ: Move all those structs to a new module. It's getting crowded here.
pub struct GeneralParseLogError {
    content: String,
    err_msg: String,
    severity: ParseLogSeverity,
}

impl GeneralParseLogError {
    pub fn new(content: String, err_msg: String, severity: ParseLogSeverity) -> Self {
        Self {
            content,
            err_msg,
            severity,
        }
    }

    //TODO: Make sure this converting is enough.
    pub fn from_parser_err(bytes: &[u8], severity: ParseLogSeverity, err: Error) -> Self {
        let content = format!("{bytes:?}");
        let err_msg = match err {
            Error::Parse(parse_err) => format!("Nested Parser Error: Parse Error: {parse_err}"),
            Error::Incomplete => "Nested Parser Error: Incomplete".into(),
            Error::Eof => "Nested Parser Error: Eof".into(),
        };

        Self {
            content,
            severity,
            err_msg,
        }
    }
}

impl ParseLogMsgError for GeneralParseLogError {
    fn parse_lossy(self) -> String {
        self.content
    }

    fn severity(&self) -> ParseLogSeverity {
        self.severity
    }

    fn error_msg(&self) -> String {
        self.err_msg.to_owned()
    }
}

pub trait LogMessage: Serialize {
    type ParseError: ParseLogMsgError;
    /// Serializes a message directly into a Writer
    /// returns the size of the serialized message
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error>;

    /// Tries to resolve the message to get its text representation, with in optional help from
    /// [`ParseRestResolver`] for the parts which can't be parsed.
    fn try_resolve(
        &self,
        // TODO: Remember the point of making the resolver optional, is to avoid infinite
        // recursions in case of parsers calling each others
        resolver: Option<&mut ParseRestResolver>,
    ) -> Result<impl Display, Self::ParseError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
/// Gives Hint about how the payload rest can be resolved
pub enum ResolveParseHint {
    /// The message needs to be parsed with SomeIP Parser.
    SomeIP,
}
