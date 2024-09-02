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

#[derive(Debug)]
pub enum MessageStreamItem<T: LogMessage> {
    Item(ParseYield<T>),
    Skipped,
    Incomplete,
    Empty,
    Done,
}

pub trait LogMessage: Serialize {
    /// Serializes a message directly into a Writer
    /// returns the size of the serialized message
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error>;

    /// Tries to resolve the message to get its text representation.
    ///
    /// TODO: This function should return another optional field, containing information
    /// about errors, warning ...
    fn try_resolve(&self) -> LogMessageContent;
}

#[derive(Debug, Clone)]
/// Represents The content of a log message after trying to resolve it.
pub enum LogMessageContent {
    Text(String),
    Template(TemplateLogMsg),
}

#[derive(Debug, Clone)]
/// Represents an unresolved log messages that contains chunks that needs to be resolved.
pub struct TemplateLogMsg {
    chunks: Vec<TemplateLogMsgChunk>,
    resolve_hints: Vec<ResolveParseHint>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
/// Gives Hint about how the payload rest can be resolved
pub enum ResolveParseHint {
    /// The message needs to be parsed with SomeIP Parser.
    SomeIP,
}

#[derive(Debug, Clone)]
/// Represents a chunk in [`TemplateLogMsg`]
pub enum TemplateLogMsgChunk {
    /// Resolved Chunk
    Text(String),
    /// Unresolved Chunk
    Bytes(Vec<u8>),
}

impl<T> From<T> for LogMessageContent
where
    T: Display,
{
    fn from(value: T) -> Self {
        Self::Text(value.to_string())
    }
}

impl TemplateLogMsg {
    pub fn new(chunks: Vec<TemplateLogMsgChunk>, resolve_hints: Vec<ResolveParseHint>) -> Self {
        Self {
            chunks,
            resolve_hints,
        }
    }

    pub fn get_resolve_hints(&self) -> Vec<ResolveParseHint> {
        self.resolve_hints.to_vec()
    }

    /// Applies the given [`FnMut`] on the unresolved chunks, replacing them with texts if succeed.
    /// This function will return a String once chunks get resolved.
    ///
    /// * `parse_fn`: Function to apply on the unresolved chunks.
    pub fn try_resolve<F>(&mut self, mut parse_fn: F) -> Option<String>
    where
        F: FnMut(&[u8]) -> Option<String>,
    {
        let mut all_resolved = true;
        for ch in self.chunks.iter_mut() {
            match ch {
                TemplateLogMsgChunk::Text(_) => continue,
                TemplateLogMsgChunk::Bytes(bytes) => match parse_fn(&bytes) {
                    Some(resolved) => *ch = TemplateLogMsgChunk::Text(resolved),
                    None => all_resolved = false,
                },
            }
        }

        if all_resolved {
            self.chunks
                .iter()
                .map(|ch| match ch {
                    TemplateLogMsgChunk::Text(msg) => msg,
                    TemplateLogMsgChunk::Bytes(_) => panic!("All must be resolved"),
                })
                .cloned()
                .reduce(|mut acc, msg| {
                    acc.push_str(&msg);
                    acc
                })
        } else {
            None
        }
    }

    /// Concatenates the chunks to a string, replacing the unresolved chunks with their bytes
    /// representation.
    pub fn resolve_lossy(self) -> String {
        self.chunks
            .into_iter()
            .fold(String::new(), |mut acc, ch| match ch {
                TemplateLogMsgChunk::Text(msg) => {
                    acc.push_str(&msg);
                    acc
                }
                TemplateLogMsgChunk::Bytes(bytes) => format!("{acc} {bytes:?}"),
            })
    }
}
