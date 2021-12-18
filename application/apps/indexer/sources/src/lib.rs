use std::fmt::Display;

#[cfg(test)]
#[macro_use]
extern crate lazy_static;

pub mod pcap;
pub mod socket;
pub mod producer;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Sources setup problem: {0}")]
    Setup(String),
    #[error("Unrecoverable source error: {0}")]
    Unrecoverable(String),
    #[error("Incomplete, not enough data for a message")]
    Incomplete,
    #[error("End of file reached")]
    Eof,
}

/// Parser trait that needs to be implemented for any parser we support
/// in chipmunk
pub trait Parser<T: LogMessage> {
    /// take a slice of bytes and try to apply a parser. If the parse was
    /// successfull, this will yield  the rest of the slice along with `Some(log_message)`
    ///
    /// if the slice does not have enough bytes, an `Incomplete` error is returned.
    ///
    /// in case we could parse a message but the message was filtered out, `None` is returned
    fn parse<'a>(
        &self,
        input: &'a [u8],
        timestamp: Option<u64>,
    ) -> Result<(&'a [u8], Option<T>), Error>;
}

pub trait LineFormat {
    fn format_line(&self) -> String;
}

pub trait LogMessage: Display {
    fn as_stored_bytes(&self) -> Vec<u8>;
}

#[derive(Debug, Clone, PartialEq)]
pub enum TransportProtocol {
    TCP,
    UDP,
    Unknown,
}

impl From<etherparse::TransportSlice<'_>> for TransportProtocol {
    fn from(tp_slice: etherparse::TransportSlice<'_>) -> Self {
        match tp_slice {
            etherparse::TransportSlice::Tcp(_) => TransportProtocol::TCP,
            etherparse::TransportSlice::Udp(_) => TransportProtocol::UDP,
            _ => TransportProtocol::Unknown,
        }
    }
}

#[derive(Debug)]
pub struct SourceFilter {
    transport: Option<TransportProtocol>,
}

pub trait ByteSource {
    /// will load more bytes from the underlying source
    /// when the source has reached it's end, this function
    /// will return Ok(None)
    /// A successfull reload operation will return the number
    /// of bytes that were loaded
    fn reload(&mut self, filter: Option<&SourceFilter>) -> Result<Option<usize>, Error>;

    fn consume(&mut self, offset: usize);

    fn current_slice(&self) -> &[u8];

    /// count of currently loaded bytes
    fn len(&self) -> usize;

    fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[derive(Debug)]
pub enum MessageStreamItem<T: LogMessage> {
    Item(T),
    Skipped,
    Incomplete,
    Empty,
    Done,
}
