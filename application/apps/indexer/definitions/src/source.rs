use async_trait::async_trait;
use thiserror::Error;

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

/// **Important NOTE**
///
/// ### Restoring the Original Asynchronous Trait Design with `async_trait`
///
/// Initially, we used the standard approach for implementing asynchronous methods in traits via `Pin<Box<dyn Future<...>>>`, which is a well-established and widely supported pattern in Rust. Later, the API was adapted to leverage the new experimental directive `#[allow(async_fn_in_trait)], which allows direct use of asynchronous methods in traits.
///
/// However, it is important to note that Rust developers intentionally did not enable this feature by default, and it requires explicit activation for several critical reasons:
///
/// 1. Partial Stabilization:
///
///    * This feature is only partially stabilized, meaning it is still subject to significant changes in future releases.
///    * Relying on partially stabilized functionality in production code can lead to unexpected maintenance costs and compatibility issues.
///
/// 2. Potential Breaking Changes:
///
///    * Given the ongoing discussions within the Rust community, this feature may undergo significant modifications, potentially breaking backward compatibility.
///
/// 3. Loss of Flexibility (Critical Issue):
///
///    * Using `#[allow(async_fn_in_trait)]` completely blocks the ability to use `Box<dyn ByteSource>`, leading to the infamous compilation error:
///
///    ```text
///    the trait is not dyn compatible because method `XXX` is `async`
///    error[E0038]: the trait `YYY` is not dyn compatible
///    ```
///
///    * This restriction completely eliminates the possibility of packing `ByteSource` instances into trait objects, which is a critical design flaw, as it significantly reduces architectural flexibility.
///    * Without this flexibility, it becomes impossible to extend the system with additional `ByteSource` and `Parser` implementations without direct modification of the core codebase.
///
/// ---
///
/// ### Why Boxing is Not a Real Problem
///
/// The practice of boxing a `ByteSource` instance in `Box<dyn ByteSource>` is not inherently problematic, for several reasons:
///
/// * Efficient Use in Hot Loops:
///
///   * Once the boxed instance is unpacked at the level of the `MessageProducer`, the cost of indirection is eliminated, allowing direct access to the underlying object.
///
/// * Negligible Allocation Overhead:
///
///   * The cost of allocating a boxed instance is a one-time event, occurring only during the initialization of a session.
///   * Given that session objects are long-lived and only created once per session, this overhead is negligible compared to the benefits of a flexible architecture.
///
/// ---
///
/// ### Restoring Flexibility and Safety with `async_trait`
///
/// Given these considerations, we have decided to revert to the "classic" and well-established approach of using `async_trait`, which wraps asynchronous methods in `Pin<Box<dyn Future<...>>>`. While this approach has a slightly higher runtime cost, it offers several critical advantages:
///
/// 1. Technical Correctness and Safety:
///
///    * We are aligning with the only officially supported and widely accepted Rust practice for asynchronous traits, which is both safe and fully optimized.
///
/// 2. Avoiding Experimental Features:
///
///    * We are removing the dependency on partially stabilized and potentially breaking features, reducing the risk of future maintenance headaches.
///
/// 3. Preserving Full Architectural Flexibility:
///
///    * This approach completely preserves the ability to separate `ByteSource` and `Parser` implementations from the core, making the architecture more modular and extensible.
///    * It also simplifies unit testing, as components can be developed, tested, and deployed independently of the core logic.
///
/// 4. Realistic Performance Considerations:
///
///    * We acknowledge a potential minor performance impact, but this is insignificant in real-world use cases.
///    * In a typical session, the initial "frame" of data is presented to the user immediately, while the full file is loaded in the background, making a 100-500ms delay on a 1GB file completely acceptable in terms of UI/UX.
///
/// ---
///
/// In summary, this decision prioritizes architectural flexibility, reduces long-term maintenance risks, and ensures code stability, making the overall system more sustainable and extensible in the long run.
///
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
