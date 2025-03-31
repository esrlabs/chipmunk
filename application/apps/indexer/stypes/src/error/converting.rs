use crate::*;

impl std::fmt::Display for NativeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            self.message
                .as_ref()
                .map(|s| s.to_owned())
                .unwrap_or_else(|| format!("Error without message ({})", self.kind))
        )
    }
}

impl std::fmt::Display for NativeErrorKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Self::FileNotFound => "FileNotFound",
                Self::UnsupportedFileType => "UnsupportedFileType",
                Self::ComputationFailed => "ComputationFailed",
                Self::Configuration => "Configuration",
                Self::Interrupted => "Interrupted",
                Self::OperationSearch => "OperationSearch",
                Self::NotYetImplemented => "NotYetImplemented",
                Self::ChannelError => "ChannelError",
                Self::Io => "Io",
                Self::Grabber => "Grabber",
                Self::Plugins => "Plugins",
            }
        )
    }
}

impl From<std::io::Error> for NativeError {
    /// Converts a `std::io::Error` into a `NativeError`.
    ///
    /// # Mapping Details
    /// - `severity`: Always set to `Severity::ERROR`.
    /// - `kind`: Mapped to `NativeErrorKind::Io`.
    /// - `message`: Set to the string representation of the `std::io::Error`.
    fn from(err: std::io::Error) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(err.to_string()),
        }
    }
}

impl From<tokio::sync::mpsc::error::SendError<CallbackEvent>> for NativeError {
    /// Converts a `tokio::sync::mpsc::error::SendError<CallbackEvent>` into a `NativeError`.
    ///
    /// # Mapping Details
    /// - `severity`: Always set to `Severity::ERROR`.
    /// - `kind`: Mapped to `NativeErrorKind::ComputationFailed`.
    /// - `message`: A formatted message indicating that the callback channel is broken.
    fn from(err: tokio::sync::mpsc::error::SendError<CallbackEvent>) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ComputationFailed,
            message: Some(format!("Callback channel is broken: {err}")),
        }
    }
}

impl From<ComputationError> for NativeError {
    /// Converts a `ComputationError` into a `NativeError`.
    ///
    /// # Mapping Details
    /// - `severity`: Always set to `Severity::ERROR`.
    /// - `kind`: Mapped to `NativeErrorKind::Io`.
    /// - `message`: Set to the string representation of the `ComputationError`.
    fn from(err: ComputationError) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(err.to_string()),
        }
    }
}
