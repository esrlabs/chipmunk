use crate::*;

// impl From<session::state::AttachmentsError> for NativeError {
//     fn from(err: session::state::AttachmentsError) -> Self {
//         NativeError {
//             severity: Severity::ERROR,
//             kind: NativeErrorKind::Io,
//             message: Some(err.to_string()),
//         }
//     }
// }

// impl From<session::state::ValuesError> for NativeError {
//     fn from(err: session::state::ValuesError) -> Self {
//         NativeError {
//             severity: Severity::ERROR,
//             kind: NativeErrorKind::Io,
//             message: Some(err.to_string()),
//         }
//     }
// }

// impl From<session::events::ComputationError> for NativeError {
//     fn from(err: session::events::ComputationError) -> Self {
//         NativeError {
//             severity: Severity::ERROR,
//             kind: NativeErrorKind::Io,
//             message: Some(err.to_string()),
//         }
//     }
// }

impl From<std::io::Error> for NativeError {
    fn from(err: std::io::Error) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(err.to_string()),
        }
    }
}

// impl From<sources::Error> for NativeError {
//     fn from(err: sources::Error) -> Self {
//         NativeError {
//             severity: Severity::ERROR,
//             kind: NativeErrorKind::ComputationFailed,
//             message: Some(format!("Fail create source: {err}")),
//         }
//     }
// }

impl From<tokio::sync::mpsc::error::SendError<CallbackEvent>> for NativeError {
    fn from(err: tokio::sync::mpsc::error::SendError<CallbackEvent>) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ComputationFailed,
            message: Some(format!("Callback channel is broken: {err}")),
        }
    }
}

// use processor::grabber::GrabError;

// impl From<GrabError> for NativeError {
//     fn from(err: GrabError) -> Self {
//         match err {
//             GrabError::IoOperation(e) => NativeError {
//                 severity: Severity::ERROR,
//                 kind: NativeErrorKind::ComputationFailed,
//                 message: Some(e),
//             },
//             GrabError::Config(msg) => NativeError {
//                 severity: Severity::ERROR,
//                 kind: NativeErrorKind::Configuration,
//                 message: Some(msg),
//             },
//             GrabError::Interrupted => NativeError {
//                 severity: Severity::ERROR,
//                 kind: NativeErrorKind::Interrupted,
//                 message: None,
//             },
//             GrabError::InvalidRange { .. } => NativeError {
//                 severity: Severity::ERROR,
//                 kind: NativeErrorKind::ComputationFailed,
//                 message: Some("Invalid Range".to_string()),
//             },
//             GrabError::Communication(s) => NativeError {
//                 severity: Severity::ERROR,
//                 kind: NativeErrorKind::ComputationFailed,
//                 message: Some(s),
//             },
//             GrabError::NotInitialize => NativeError {
//                 severity: Severity::ERROR,
//                 kind: NativeErrorKind::ComputationFailed,
//                 message: Some("Grabbing failed, not initialized".to_owned()),
//             },
//             GrabError::Unsupported(s) => NativeError {
//                 severity: Severity::ERROR,
//                 kind: NativeErrorKind::ComputationFailed,
//                 message: Some(format!("File type is not supported: {s}")),
//             },
//         }
//     }
// }
