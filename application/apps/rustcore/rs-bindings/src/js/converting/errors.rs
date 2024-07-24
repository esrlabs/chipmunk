use super::error::E;
use error::{
    computation_error::{self, Error},
    grab_error, search_error,
};
use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use processor::{grabber::GrabError, search::error::SearchError};
use proto::*;
use session::events::{NativeError, NativeErrorKind};
use session::{events::ComputationError, progress::Severity};

#[derive(Debug)]
pub struct ComputationErrorWrapper(Option<ComputationError>);

impl ComputationErrorWrapper {
    pub fn new(err: ComputationError) -> Self {
        Self(Some(err))
    }
}

impl From<E> for ComputationErrorWrapper {
    fn from(err: E) -> Self {
        ComputationErrorWrapper::new(ComputationError::Protocol(err.to_string()))
    }
}

impl TryIntoJs for ComputationErrorWrapper {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        let bytes: Vec<u8> = self.into();
        bytes.try_to_js(js_env)
    }
}

impl From<ComputationError> for ComputationErrorWrapper {
    fn from(err: ComputationError) -> ComputationErrorWrapper {
        ComputationErrorWrapper::new(err)
    }
}

pub fn get_native_err(err: NativeError) -> error::NativeError {
    error::NativeError {
        severity: match err.severity {
            Severity::ERROR => error::Severity::Error.into(),
            Severity::WARNING => error::Severity::Warning.into(),
        },
        kind: match err.kind {
            NativeErrorKind::ChannelError => error::NativeErrorKind::ChannelError.into(),
            NativeErrorKind::ComputationFailed => error::NativeErrorKind::ComputationFailed.into(),
            NativeErrorKind::Configuration => error::NativeErrorKind::Configuration.into(),
            NativeErrorKind::FileNotFound => error::NativeErrorKind::FileNotFound.into(),
            NativeErrorKind::Grabber => error::NativeErrorKind::Grabber.into(),
            NativeErrorKind::Interrupted => error::NativeErrorKind::Interrupted.into(),
            NativeErrorKind::Io => error::NativeErrorKind::Io.into(),
            NativeErrorKind::NotYetImplemented => error::NativeErrorKind::NotYetImplemented.into(),
            NativeErrorKind::OperationSearch => error::NativeErrorKind::OperationSearch.into(),
            NativeErrorKind::UnsupportedFileType => {
                error::NativeErrorKind::UnsupportedFileType.into()
            }
        },
        message: err.message.unwrap_or_default(),
    }
}

fn get_grab_err(err: GrabError) -> error::GrabError {
    error::GrabError {
        error: Some(match err {
            GrabError::Communication(message) => {
                grab_error::Error::Communication(grab_error::Communication { message })
            }
            GrabError::Config(message) => grab_error::Error::Config(grab_error::Config { message }),
            GrabError::IoOperation(message) => {
                grab_error::Error::IoOperation(grab_error::IoOperation { message })
            }
            GrabError::Unsupported(message) => {
                grab_error::Error::Unsupported(grab_error::Unsupported { message })
            }
            GrabError::NotInitialize => {
                grab_error::Error::NotInitialize(grab_error::NotInitialize {})
            }
            GrabError::Interrupted => grab_error::Error::Interrupted(grab_error::Interrupted {}),
            GrabError::InvalidRange { range, context } => {
                grab_error::Error::InvalidRange(grab_error::InvalidRange {
                    range: Some(common::RangeInclusive {
                        start: range.start(),
                        end: range.end(),
                    }),
                    context,
                })
            }
        }),
    }
}

fn get_search_err(err: SearchError) -> error::SearchError {
    error::SearchError {
        error: Some(match err {
            SearchError::Aborted(message) => {
                search_error::Error::Aborted(search_error::Aborted { message })
            }
            SearchError::Communication(message) => {
                search_error::Error::Communication(search_error::Communication { message })
            }
            SearchError::Config(message) => {
                search_error::Error::Config(search_error::Config { message })
            }
            SearchError::Grab(err) => search_error::Error::Grab(search_error::Grab {
                error: Some(get_grab_err(err)),
            }),
            SearchError::Input(message) => {
                search_error::Error::Input(search_error::Input { message })
            }
            SearchError::IoOperation(message) => {
                search_error::Error::IoOperation(search_error::IoOperation { message })
            }
            SearchError::Regex(message) => {
                search_error::Error::Regex(search_error::Regex { message })
            }
        }),
    }
}
impl From<ComputationErrorWrapper> for Vec<u8> {
    fn from(mut val: ComputationErrorWrapper) -> Self {
        let err = val.0.take().expect("Error has to be provided");
        let msg = error::ComputationError {
            error: Some(match err {
                ComputationError::Communication(message) => {
                    Error::Communication(computation_error::Communication { message })
                }
                ComputationError::DestinationPath => {
                    Error::DestinationPath(computation_error::DestinationPath {})
                }
                ComputationError::SessionCreatingFail => {
                    Error::SessionCreatingFail(computation_error::SessionCreatingFail {})
                }
                ComputationError::MultipleInitCall => {
                    Error::MultipleInitCall(computation_error::MultipleInitCall {})
                }
                ComputationError::InvalidData => {
                    Error::InvalidData(computation_error::InvalidData {})
                }
                ComputationError::SessionUnavailable => {
                    Error::SessionUnavailable(computation_error::SessionUnavailable {})
                }
                ComputationError::Grabbing(err) => Error::Grabbing(computation_error::Grabbing {
                    error: Some(get_grab_err(err)),
                }),
                ComputationError::OperationNotSupported(message) => {
                    Error::OperationNotSupported(computation_error::OperationNotSupported {
                        message,
                    })
                }
                ComputationError::IoOperation(message) => {
                    Error::IoOperation(computation_error::IoOperation { message })
                }
                ComputationError::InvalidArgs(message) => {
                    Error::InvalidArgs(computation_error::InvalidArgs { message })
                }
                ComputationError::Process(message) => {
                    Error::Process(computation_error::Process { message })
                }
                ComputationError::Protocol(message) => {
                    Error::Protocol(computation_error::Protocol { message })
                }
                ComputationError::SearchError(err) => Error::SearchError(get_search_err(err)),
                ComputationError::Sde(message) => Error::Sde(computation_error::Sde { message }),
                ComputationError::NativeError(err) => Error::NativeError(get_native_err(err)),
            }),
        };
        prost::Message::encode_to_vec(&msg)
    }
}
