use crate::*;
use stypes::SessionAction;
use thiserror::Error;

/// Defines the function type used to construct a source instance for a session.
///
/// This factory function is stored in the [`Register`] and invoked when a new session
/// is initialized. It produces a source instance based on the provided session context
/// and configuration fields.
///
/// The return value is a tuple:
/// - [`Sources`] – An enum-wrapped instance of the constructed source.
/// - `Option<String>` – A human-readable label that describes the configured source in context.
///
/// The key difference between this label and the one returned by [`CommonDescriptor`] is
/// that this one is **contextual**. While `CommonDescriptor` may return a generic name such
/// as `"Serial port connector"`, this factory may return a context-specific name like
/// `"Serial on /dev/tty001"` that reflects actual settings.
///
/// # Arguments
///
/// * `&SessionAction` – The session action context (e.g., user-triggered session creation).
/// * `&[stypes::Field]` – A list of configuration fields provided by the client or system.
///
/// # Returns
///
/// * `Ok(Some((Sources, Option<String>)))` – A constructed source instance with an optional
///   context-specific name for display.
/// * `Ok(None)` – Indicates that no source should be created (e.g., conditionally skipped).
/// * `Err(NativeError)` – If source creation fails due to invalid data or internal error.
///
/// # Errors
///
/// Returns an `Err(NativeError)` if the source cannot be created due to misconfiguration,
/// validation failure, or runtime errors during instantiation.
pub type SourceFactory = fn(
    &SessionAction,
    &[stypes::Field],
) -> Result<Option<(Sources, Option<String>)>, stypes::NativeError>;

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
    pub transport: Option<TransportProtocol>,
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
pub enum SourceError {
    #[error("Sources setup problem: {0}")]
    Setup(String),
    #[error("Unrecoverable source error: {0}")]
    Unrecoverable(String),
    #[error("IO error: {0}")]
    Io(std::io::Error),
    #[error("Not supported feature")]
    NotSupported,
}

impl From<SourceError> for stypes::NativeError {
    fn from(err: SourceError) -> Self {
        stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::ComputationFailed,
            message: Some(format!("Fail create source: {err}")),
        }
    }
}

pub const DEFAULT_READER_CAPACITY: usize = 10 * 1024 * 1024;
pub const DEFAULT_MIN_BUFFER_SPACE: usize = 10 * 1024;

/// Requirements to `ByteSource` inner reader
pub trait InnerReader: std::io::Read + Send + Unpin + 'static {}

/// In summary, this decision prioritizes architectural flexibility, reduces long-term maintenance
/// risks, and ensures code stability, making the overall system more sustainable and extensible
/// in the long run.
///
/// A `ByteSource` provides a way to read data from some underlying data source. But it does
/// not provide a simple read interface, rather it allows implementations to filter the data
/// while reading it from it's underlying source.
/// A good example is a network trace where complete ethernet frames are described. If we only
/// want to extract the data part from certain frames, the `relaod` method will load only the relevant
/// data into an internal buffer.
/// This data can then be accessed via the `current_slice` method.
#[allow(async_fn_in_trait)]
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
    /// A successful reload operation will return the number
    /// of bytes that were newly loaded `newly_loaded_bytes`
    /// along with all currently available bytes `available_bytes`
    /// In some cases it is possible that some bytes had to be skipped in order to
    /// reach the next usable bytes, this is indicated in the `skipped_bytes` number
    ///
    ///
    /// If the source has access to some timestamp (e.g. timestamp of network package),
    /// this timestamp is passed on additionally (`last_known_ts`)
    ///
    /// # Note:
    ///
    /// This function must be **Cancel-Safe**
    async fn load(
        &mut self,
        filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError>;

    /// In case the ByteSource is some kind of connection that does not end,
    /// cancel can be implemented that will give the ByteSource the chance to perform some
    /// cleanup before the ByteSource is discarded
    async fn cancel(&mut self) -> Result<(), SourceError> {
        Ok(())
    }

    /// Append incoming (SDE) Source-Data-Exchange to the data.
    async fn income(
        &mut self,
        _msg: stypes::SdeRequest,
    ) -> Result<stypes::SdeResponse, SourceError> {
        Err(SourceError::NotSupported)
    }
}
