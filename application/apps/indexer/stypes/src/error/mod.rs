#[cfg(any(test, feature = "rustcore"))]
mod converting;
#[cfg(any(test, feature = "rustcore"))]
mod extending;
#[cfg(any(test, feature = "rustcore"))]
mod formating;

use crate::*;

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
