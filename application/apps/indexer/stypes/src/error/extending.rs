use crate::*;

impl NativeError {
    /// Creates a `NativeError` representing a channel-related error.
    ///
    /// # Parameters
    /// - `msg`: A message describing the error.
    ///
    /// # Returns
    /// A `NativeError` instance with:
    /// - `severity`: Set to `Severity::ERROR`.
    /// - `kind`: Set to `NativeErrorKind::ChannelError`.
    /// - `message`: Set to the provided message.
    pub fn channel(msg: &str) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(msg)),
        }
    }
    pub fn io(msg: &str) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(String::from(msg)),
        }
    }
}

impl Severity {
    /// Returns a string representation of the `Severity` value.
    ///
    /// # Returns
    /// - `"WARNING"` for `Severity::WARNING`.
    /// - `"ERROR"` for `Severity::ERROR`.
    pub fn as_str(&self) -> &str {
        match self {
            Severity::WARNING => "WARNING",
            Severity::ERROR => "ERROR",
        }
    }
}
