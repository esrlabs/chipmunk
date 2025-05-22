use serde::Serialize;
use std::borrow::Cow;

pub const COLUMN_SENTINAL: char = '\u{0004}';

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

#[derive(Debug)]
pub struct ParseOperationResult {
    /// Number of consumed bytes
    pub consumed: usize,
    /// Count of parsed and sent messages
    pub count: usize,
}

impl ParseOperationResult {
    pub fn new(consumed: usize, count: usize) -> Self {
        Self { consumed, count }
    }
    pub fn parsed_any_msg(&self) -> bool {
        self.count > 0
    }
}

/// Defines the shape of data that a parser can emit to a `MessageProducer`.
///
/// # Design Philosophy
///
/// Only the parser has full knowledge of the semantics and structure of the data
/// it processes. Therefore, the parser alone should decide how to best represent
/// that data. For example, a DLT parser naturally produces columnar data, while
/// another parser might emit raw binary content.
///
/// Previous approaches attempted to force all parser outputs to conform to a trait
/// like `LogMessage`, requiring implementations of `to_string()` or `write()` methods.
/// This contradicts the role of the parser, which is **not** responsible for data
/// conversion or formatting.
///
/// Instead, the parser emits data in its native structure, and it is the responsibility
/// of higher-level components (like `MessageProducer`) to format, serialize, or
/// store it as needed. For example, in the case of DLT:
///
/// - The parser should emit structured columns.
/// - The `MessageProducer` should determine how to format those columns into lines
///   and write them to a session file.
///
/// If different output is required (e.g., exporting DLT data as raw bytes), a different
/// parser implementation (such as `DltRaw`) should be used.
pub enum LogRecordOutput<'a> {
    /// A raw binary message.
    Raw(&'a [u8]),

    /// A borrowed UTF-8 string slice.
    Str(&'a str),

    /// A string wrapped in a [`Cow`] (Copy-on-Write), allowing either borrowed or owned data.
    Cow(Cow<'a, str>),

    /// An owned UTF-8 string.
    String(String),

    /// Structured columnar data. Typically used when the parser can extract
    /// meaningful fields and present them as an array of strings.
    Columns(&'a [&'a str]),

    /// An attachment object, such as a binary blob or associated metadata.
    /// These are handled separately from textual data and require special treatment
    /// during output (e.g., saved as files, linked from logs, etc.).
    Attachment(Attachment),

    /// A compound message containing multiple outputs found during a single parsing iteration.
    /// This is useful when the parser extracts several independent pieces of data at once.
    Multiple(Vec<LogRecordOutput<'a>>),
}

/// Interface for implementing a writer that handles log records.
///
/// An instance of `LogRecordWriter` is passed to a `MessageProducer`.
/// Each time a new log record is available, the `MessageProducer` invokes the `write` method.
/// The specific behavior for writing records to the actual destination is left to the implementation.
///
/// This allows implementors to define their own strategies for data caching, batching, and flushing.
/// When the `MessageProducer` has no more data to process, it calls `finalize`. At that point,
/// the writer should persist any buffered data, if applicable.
///
/// **Important:** The `write` method must not be asynchronous. This is required to keep
/// the `MessageProducer` cancel-safe.
///
/// # Examples
/// An implementation might buffer records in memory and write them in bulk
/// every few seconds, or directly write to a file, database, or network sink.
pub trait LogRecordWriter {
    /// Called for every new log record received from the `MessageProducer`.
    ///
    /// # Arguments
    /// * `record` – A reference to a [`LogRecordOutput`] containing the data to write.
    ///
    /// # Returns
    /// * `Ok(())` on success.
    /// * `Err(NativeError)` if the write operation fails.
    fn write(&mut self, record: LogRecordOutput<'_>) -> Result<(), stypes::NativeError>;

    /// Called once when the `MessageProducer` has no more data to provide.
    ///
    /// There is no guarantee that `write` won’t be called again after `finalize`
    /// (e.g., in a file tailing scenario), but `finalize` itself is guaranteed
    /// to be called only once.
    ///
    /// This is the opportunity to flush any buffered data and perform cleanup if necessary.
    ///
    /// # Returns
    /// * `Ok(())` on success.
    /// * `Err(NativeError)` if the finalization process fails.
    fn finalize(&mut self) -> Result<(), stypes::NativeError>;

    /// Returns the unique identifier of the associated data source.
    ///
    /// This ID can be used to correlate logs with their origin,
    /// especially in multi-source scenarios.
    ///
    /// # Returns
    /// A `u16` representing the unique source ID.
    fn get_id(&self) -> u16;
}
