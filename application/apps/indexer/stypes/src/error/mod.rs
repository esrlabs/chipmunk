#[cfg(feature = "rustcore")]
mod converting;
#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "rustcore")]
mod formating;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;
use thiserror::Error;

/// Indicates the severity level of an error.
#[allow(clippy::upper_case_acronyms)]
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "error.ts")
)]
pub enum Severity {
    /// Warning level, indicates a recoverable issue.
    WARNING,
    /// Error level, indicates a critical issue.
    ERROR,
}

/// Defines the source or type of an error.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "error.ts")
)]
pub enum NativeErrorKind {
    /// The file was not found.
    FileNotFound,
    /// The file type is not supported.
    UnsupportedFileType,
    /// A computation process failed.
    ComputationFailed,
    /// Configuration-related errors.
    Configuration,
    /// The operation was interrupted.
    Interrupted,
    /// Errors related to search operations.
    OperationSearch,
    /// The feature or functionality is not yet implemented.
    NotYetImplemented,
    /// Errors related to communication channels between loops within a session.
    /// Typically indicates that a loop ended prematurely, preventing message delivery.
    ChannelError,
    /// Input/output-related errors.
    Io,
    /// Errors related to reading session data, including search result data.
    Grabber,
}

/// Describes the details of an error.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "error.ts")
)]
pub struct NativeError {
    /// The severity level of the error.
    pub severity: Severity,
    /// The type or source of the error.
    pub kind: NativeErrorKind,
    /// A detailed message describing the error.
    pub message: Option<String>,
}

/// Describes the type and details of an error.
#[derive(Error, Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "error.ts")
)]
pub enum ComputationError {
    /// The destination path must be defined to stream from `MessageProducer`.
    #[error("Destination path should be defined to stream from MessageProducer")]
    DestinationPath,
    /// Failed to create a session.
    #[error("Fail to create session")]
    SessionCreatingFail,
    /// A communication error occurred. Includes a description.
    #[error("Native communication error ({0})")]
    Communication(String),
    /// An unsupported operation was attempted. Includes the operation name.
    #[error("Operation not supported ({0})")]
    OperationNotSupported(String),
    /// An input/output error occurred. Includes a description.
    #[error("IO error ({0})")]
    IoOperation(String),
    /// Invalid data was encountered.
    #[error("Invalid data error")]
    InvalidData,
    /// Invalid arguments were provided. Includes a description.
    #[error("Invalid arguments")]
    InvalidArgs(String),
    /// An error occurred during processing. Includes a description.
    #[error("Error during processing: ({0})")]
    Process(String),
    /// An API was used incorrectly. Includes a description.
    #[error("Wrong usage of API: ({0})")]
    Protocol(String),
    /// A search-related error occurred. Includes a description.
    #[error("Search related error: {0}")]
    SearchError(String),
    /// The `start` method can only be called once.
    #[error("start method can be called just once")]
    MultipleInitCall,
    /// The session is unavailable, either destroyed or not initialized.
    #[error("Session is destroyed or not inited yet")]
    SessionUnavailable,
    /// A native error occurred. Includes the error details.
    #[error("{0:?}")]
    NativeError(NativeError),
    /// Unable to grab content. Includes a description.
    #[error("Grabbing content not possible: {0}")]
    Grabbing(String),
    /// An error occurred while sending data to the source. Includes a description.
    #[error("Sending data to source error: {0}")]
    Sde(String),
    /// An error occurred while decoding a message. Includes a description.
    #[error("Decoding message error: {0}")]
    Decoding(String),
    /// An error occurred while encoding a message. Includes a description.
    #[error("Encoding message error: {0}")]
    Encoding(String),
}
