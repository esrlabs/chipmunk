use async_trait::async_trait;
use thiserror::Error;

#[cfg(test)]
#[macro_use]
extern crate lazy_static;

#[macro_use]
extern crate log;

pub mod factory;
pub mod pcap;
pub mod producer;
pub mod raw;
pub mod serial;
pub mod socket;

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

#[derive(Debug)]
pub struct ReloadInfo {
    newly_loaded_bytes: usize,
    available_bytes: usize,
    skipped_bytes: usize,
    last_known_ts: Option<u64>,
}

impl ReloadInfo {
    pub fn new(
        newly_loaded_bytes: usize,
        available_bytes: usize,
        skipped_bytes: usize,
        last_known_ts: Option<u64>,
    ) -> Self {
        Self {
            newly_loaded_bytes,
            available_bytes,
            skipped_bytes,
            last_known_ts,
        }
    }
}

#[derive(Error, Debug)]
pub enum Error {
    #[error("Sources setup problem: {0}")]
    Setup(String),
    #[error("Unrecoverable source error: {0}")]
    Unrecoverable(String),
}

pub(crate) const DEFAULT_READER_CAPACITY: usize = 10 * 1024 * 1024;
pub(crate) const DEFAULT_MIN_BUFFER_SPACE: usize = 10 * 1024;

#[async_trait]
pub trait ByteSource {
    fn consume(&mut self, offset: usize);

    fn current_slice(&self) -> &[u8];

    /// count of currently loaded bytes
    fn len(&self) -> usize;

    fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// will load more bytes from the underlying source
    /// when the source has reached it's end, this function
    /// will return Ok((None, _))
    ///
    /// A successfull reload operation will return the number
    /// of bytes that were newly loaded `newly_loaded_bytes`
    /// along with all currently available bytes `available_bytes`
    /// In some cases it is possible that some bytes had to be skipped in order to
    /// reach the next usable bytes, this is indicated in the `skipped_bytes` number
    ///
    ///
    /// If the source has access to some timestamp (e.g. timestamp of network package),
    /// this timestamp is passed on additionally (`last_known_ts`)
    async fn reload(&mut self, filter: Option<&SourceFilter>) -> Result<Option<ReloadInfo>, Error>;
}
