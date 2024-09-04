#![deny(unused_crate_dependencies)]
use async_trait::async_trait;
use thiserror::Error;

#[macro_use]
extern crate lazy_static;

#[macro_use]
extern crate log;

pub mod binary;
pub mod command;
pub mod factory;
pub mod plugins;
pub mod producer;
pub mod sde;
pub mod serial;
pub mod socket;

#[derive(Debug, Clone, PartialEq, Eq)]
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
    pub newly_loaded_bytes: usize,
    pub available_bytes: usize,
    pub skipped_bytes: usize,
    pub last_known_ts: Option<u64>,
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
    #[error("IO error: {0}")]
    Io(std::io::Error),
    #[error("Not supported feature")]
    NotSupported,
}

pub(crate) const DEFAULT_READER_CAPACITY: usize = 10 * 1024 * 1024;
pub(crate) const DEFAULT_MIN_BUFFER_SPACE: usize = 10 * 1024;

/// A `ByteSource` provides a way to read data from some underlying data source. But it does
/// not provide a simple read interface, rather it allows implementations to filter the data
/// while reading it from it's underlying source.
/// A good example is a network trace where complete ethernet frames are described. If we only
/// want to extract the data part from certain frames, the `relaod` method will load only the relevant
/// data into an internal buffer.
/// This data can then be accessed via the `current_slice` method.
#[async_trait]
pub trait ByteSource: Send {
    /// Indicate that we have consumed a certain amount of data from our internal
    /// buffer and that this part can be discarded
    fn consume(&mut self, offset: usize);

    /// Provide access to the filtered data that is currently loaded
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

    /// In case the ByteSource is some kind of connection that does not end,
    /// cancel can be implemented that will give the ByteSource the chance to perform some
    /// cleanup before the ByteSource is discarded
    async fn cancel(&mut self) -> Result<(), Error> {
        Ok(())
    }

    async fn income(&mut self, _msg: sde::SdeRequest) -> Result<sde::SdeResponse, Error> {
        Err(Error::NotSupported)
    }
}
