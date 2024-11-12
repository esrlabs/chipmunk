use super::error::E;
use error::{computation_error, grab_error, search_error};
use node_bindgen::{
    core::{safebuffer::SafeArrayBuffer, val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use processor::{grabber::GrabError, search::error::SearchError};
use proto::*;
use session::events::{NativeError, NativeErrorKind};
use session::{events::ComputationError, progress::Severity};

#[derive(Debug)]
pub struct ComputationErrorWrapper(pub Option<ComputationError>);

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
        SafeArrayBuffer::new(self.into()).try_to_js(js_env)
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
        grab_error_oneof: Some(match err {
            GrabError::Communication(message) => {
                grab_error::GrabErrorOneof::GrabCommunication(grab_error::GrabCommunication {
                    message,
                })
            }
            GrabError::Config(message) => {
                grab_error::GrabErrorOneof::GrabConfig(grab_error::GrabConfig { message })
            }
            GrabError::IoOperation(message) => {
                grab_error::GrabErrorOneof::GrabIoOperation(grab_error::GrabIoOperation { message })
            }
            GrabError::Unsupported(message) => {
                grab_error::GrabErrorOneof::Unsupported(grab_error::Unsupported { message })
            }
            GrabError::NotInitialize => {
                grab_error::GrabErrorOneof::NotInitialize(grab_error::NotInitialize {})
            }
            GrabError::Interrupted => {
                grab_error::GrabErrorOneof::Interrupted(grab_error::Interrupted {})
            }
            GrabError::InvalidRange { range, context } => {
                grab_error::GrabErrorOneof::InvalidRange(grab_error::InvalidRange {
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
        search_error_oneof: Some(match err {
            SearchError::Aborted(message) => {
                search_error::SearchErrorOneof::Aborted(search_error::Aborted { message })
            }
            SearchError::Communication(message) => {
                search_error::SearchErrorOneof::SearchCommunication(
                    search_error::SearchCommunication { message },
                )
            }
            SearchError::Config(message) => {
                search_error::SearchErrorOneof::SearchConfig(search_error::SearchConfig { message })
            }
            SearchError::Grab(err) => search_error::SearchErrorOneof::Grab(search_error::Grab {
                error: Some(get_grab_err(err)),
            }),
            SearchError::Input(message) => {
                search_error::SearchErrorOneof::Input(search_error::Input { message })
            }
            SearchError::IoOperation(message) => {
                search_error::SearchErrorOneof::SearchIoOperation(search_error::SearchIoOperation {
                    message,
                })
            }
            SearchError::Regex(message) => {
                search_error::SearchErrorOneof::Regex(search_error::Regex { message })
            }
        }),
    }
}
impl From<ComputationErrorWrapper> for Vec<u8> {
    fn from(mut val: ComputationErrorWrapper) -> Self {
        let err = val.0.take().expect("Error has to be provided");
        let msg = error::ComputationError {
            comp_error_oneof: Some(match err {
                ComputationError::Communication(message) => {
                    computation_error::CompErrorOneof::CompCommunication(
                        computation_error::CompCommunication { message },
                    )
                }
                ComputationError::DestinationPath => {
                    computation_error::CompErrorOneof::DestinationPath(
                        computation_error::DestinationPath {},
                    )
                }
                ComputationError::SessionCreatingFail => {
                    computation_error::CompErrorOneof::SessionCreatingFail(
                        computation_error::SessionCreatingFail {},
                    )
                }
                ComputationError::MultipleInitCall => {
                    computation_error::CompErrorOneof::MultipleInitCall(
                        computation_error::MultipleInitCall {},
                    )
                }
                ComputationError::InvalidData => computation_error::CompErrorOneof::InvalidData(
                    computation_error::InvalidData {},
                ),
                ComputationError::SessionUnavailable => {
                    computation_error::CompErrorOneof::SessionUnavailable(
                        computation_error::SessionUnavailable {},
                    )
                }
                ComputationError::Grabbing(err) => {
                    computation_error::CompErrorOneof::Grabbing(computation_error::Grabbing {
                        error: Some(get_grab_err(err)),
                    })
                }
                ComputationError::OperationNotSupported(message) => {
                    computation_error::CompErrorOneof::OperationNotSupported(
                        computation_error::OperationNotSupported { message },
                    )
                }
                ComputationError::IoOperation(message) => {
                    computation_error::CompErrorOneof::CompIoOperation(
                        computation_error::CompIoOperation { message },
                    )
                }
                ComputationError::InvalidArgs(message) => {
                    computation_error::CompErrorOneof::InvalidArgs(computation_error::InvalidArgs {
                        message,
                    })
                }
                ComputationError::Process(message) => {
                    computation_error::CompErrorOneof::Process(computation_error::Process {
                        message,
                    })
                }
                ComputationError::Protocol(message) => {
                    computation_error::CompErrorOneof::Protocol(computation_error::Protocol {
                        message,
                    })
                }
                ComputationError::SearchError(err) => {
                    computation_error::CompErrorOneof::SearchError(get_search_err(err))
                }
                ComputationError::Sde(message) => {
                    computation_error::CompErrorOneof::Sde(computation_error::Sde { message })
                }
                ComputationError::NativeError(err) => {
                    computation_error::CompErrorOneof::NativeError(get_native_err(err))
                }
            }),
        };
        prost::Message::encode_to_vec(&msg)
    }
}
