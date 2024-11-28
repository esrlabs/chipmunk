use crate::*;

impl From<std::io::Error> for NativeError {
    fn from(err: std::io::Error) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(err.to_string()),
        }
    }
}

impl From<tokio::sync::mpsc::error::SendError<CallbackEvent>> for NativeError {
    fn from(err: tokio::sync::mpsc::error::SendError<CallbackEvent>) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ComputationFailed,
            message: Some(format!("Callback channel is broken: {err}")),
        }
    }
}
