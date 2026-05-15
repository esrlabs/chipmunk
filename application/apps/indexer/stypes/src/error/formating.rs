use crate::{NativeError, NativeErrorKind, Severity};

impl std::fmt::Display for NativeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let NativeError {
            severity,
            kind,
            message,
        } = self;

        match message {
            Some(message) if !message.is_empty() => write!(f, "{severity} {kind}: {message}"),
            _ => write!(f, "{severity} {kind}"),
        }
    }
}

impl std::fmt::Display for Severity {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Self::WARNING => "WARNING",
                Self::ERROR => "ERROR",
            }
        )
    }
}

impl std::fmt::Display for NativeErrorKind {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        let label = match self {
            Self::FileNotFound => "file not found",
            Self::UnsupportedFileType => "unsupported file type",
            Self::ComputationFailed => "computation failed",
            Self::Configuration => "configuration",
            Self::Interrupted => "interrupted",
            Self::OperationSearch => "search operation",
            Self::NotYetImplemented => "not yet implemented",
            Self::ChannelError => "channel error",
            Self::Io => "I/O",
            Self::Grabber => "grabber",
            Self::Plugins => "plugins",
        };

        write!(f, "{label}")
    }
}
