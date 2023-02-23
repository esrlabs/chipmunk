pub mod dlt;
pub mod someip;
pub mod text;
use chrono::NaiveDate;
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
    ) -> Result<(&'a [u8], Option<T>), Error>;

    fn collector(&self) -> Option<Box<dyn Collector<T>>> {
        None
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Attachement {
    pub name: String,
    pub size: usize,
    pub created_date: Option<String>,
    pub modified_date: Option<String>,
    pub messages: Vec<usize>,
    /// The data chunks with byte offset and length within the original DLT trace.
    pub chunks: Vec<(usize, usize)>,
}

impl Attachement {
    /// Returns a file-system save name, prefixed by either
    /// the timestamp of the DLT message, or if not available
    /// the id of the file.
    pub fn save_name(&self) -> String {
        format!(
            "{}_{}",
            self.modified_date.as_ref().unwrap_or(&"".into()),
            self.name.replace(['\\', '/'], "$").replace(' ', "_")
        )
    }
}

pub trait Collector<T> {
    fn register_message(&mut self, offset: usize, msg: &T);
    fn attachement_indexes(&self) -> Vec<Attachement>;
    fn save_name(&self, attachment: &Attachement) -> String;
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
    Item(T),
    Skipped,
    Incomplete,
    Empty,
    Done,
}
