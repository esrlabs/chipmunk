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

#[allow(clippy::upper_case_acronyms)]
#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
#[extend::encode_decode]
pub enum Severity {
    WARNING,
    ERROR,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub enum NativeErrorKind {
    /// The file in question does not exist
    FileNotFound,
    /// The file type is not currently supported
    UnsupportedFileType,
    ComputationFailed,
    Configuration,
    Interrupted,
    OperationSearch,
    NotYetImplemented,
    ChannelError,
    Io,
    Grabber,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct NativeError {
    pub severity: Severity,
    pub kind: NativeErrorKind,
    pub message: Option<String>,
}

#[derive(Error, Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub enum ComputationError {
    #[error("Destination path should be defined to stream from MassageProducer")]
    DestinationPath,
    #[error("Fail to create session")]
    SessionCreatingFail,
    #[error("Native communication error ({0})")]
    Communication(String),
    #[error("Operation not supported ({0})")]
    OperationNotSupported(String),
    #[error("IO error ({0})")]
    IoOperation(String),
    #[error("Invalid data error")]
    InvalidData,
    #[error("Invalid arguments")]
    InvalidArgs(String),
    #[error("Error during processing: ({0})")]
    Process(String),
    #[error("Wrong usage of API: ({0})")]
    Protocol(String),
    #[error("Search related error: {0}")]
    SearchError(String),
    #[error("start method canbe called just once")]
    MultipleInitCall,
    #[error("Session is destroyed or not inited yet")]
    SessionUnavailable,
    #[error("{0:?}")]
    NativeError(NativeError),
    #[error("Grabbing content not possible: {0}")]
    Grabbing(String),
    #[error("Sending data to source error: {0}")]
    Sde(String),
    #[error("Decoding message error: {0}")]
    Decoding(String),
    #[error("Encoding message error: {0}")]
    Encoding(String),
}
