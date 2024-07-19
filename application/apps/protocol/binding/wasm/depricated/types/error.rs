use crate::*;
use prost::Message;
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::to_value;
use std::ops::RangeInclusive;
use thiserror::Error;
use wasm_bindgen::prelude::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NativeError {
    pub severity: Severity,
    pub kind: NativeErrorKind,
    pub message: Option<String>,
}

impl TryFrom<error::NativeError> for NativeError {
    type Error = E;
    fn try_from(v: error::NativeError) -> Result<Self, Self::Error> {
        Ok(NativeError {
            severity: v.severity.try_into()?,
            message: if v.message.is_empty() {
                None
            } else {
                Some(v.message)
            },
            kind: v.kind.try_into()?,
        })
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
pub enum Severity {
    WARNING,
    ERROR,
}

impl TryFrom<error::Severity> for Severity {
    type Error = E;
    fn try_from(v: error::Severity) -> Result<Self, Self::Error> {
        Ok(match v {
            error::Severity::Warning => Self::WARNING,
            error::Severity::Error => Self::ERROR,
        })
    }
}

impl TryFrom<i32> for Severity {
    type Error = E;
    fn try_from(v: i32) -> Result<Self, Self::Error> {
        Ok(match v {
            0 => Self::WARNING,
            1 => Self::ERROR,
            _ => Err(E::InvalidValue(format!("Fail parse Severity from \"{v}\"")))?,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum NativeErrorKind {
    FileNotFound,
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

impl TryFrom<i32> for NativeErrorKind {
    type Error = E;
    fn try_from(v: i32) -> Result<Self, Self::Error> {
        Ok(match v {
            0 => Self::FileNotFound,
            1 => Self::UnsupportedFileType,
            2 => Self::ComputationFailed,
            3 => Self::Configuration,
            4 => Self::Interrupted,
            5 => Self::OperationSearch,
            6 => Self::NotYetImplemented,
            7 => Self::ChannelError,
            8 => Self::Io,
            9 => Self::Grabber,
            _ => Err(E::InvalidValue(format!(
                "Fail parse NativeErrorKind from \"{v}\""
            )))?,
        })
    }
}

#[derive(Error, Debug, Serialize, Deserialize)]
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
    #[error("Search related error")]
    SearchError(SearchError),
    #[error("start method canbe called just once")]
    MultipleInitCall,
    #[error("Session is destroyed or not inited yet")]
    SessionUnavailable,
    #[error("{0:?}")]
    NativeError(NativeError),
    #[error("Grabbing content not possible: {0:?}")]
    Grabbing(#[from] GrabError),
    #[error("Sending data to source error: {0:?}")]
    Sde(String),
}

impl TryFrom<error::ComputationError> for ComputationError {
    type Error = E;
    fn try_from(v: error::ComputationError) -> Result<Self, Self::Error> {
        use error::computation_error::Error;

        let err = v.error.ok_or(E::MissedField(String::from("error")))?;
        Ok(match err {
            Error::Communication(v) => ComputationError::Communication(v.message),
            Error::DestinationPath(..) => ComputationError::DestinationPath,
            Error::Grabbing(v) => ComputationError::Grabbing(
                v.error
                    .ok_or(E::MissedField(String::from("error")))?
                    .try_into()?,
            ),
            Error::InvalidArgs(v) => ComputationError::InvalidArgs(v.message),
            Error::InvalidData(..) => ComputationError::InvalidData,
            Error::IoOperation(v) => ComputationError::IoOperation(v.message),
            Error::MultipleInitCall(..) => ComputationError::MultipleInitCall,
            Error::NativeError(v) => ComputationError::NativeError(v.try_into()?),
            Error::OperationNotSupported(v) => ComputationError::OperationNotSupported(v.message),
            Error::Process(v) => ComputationError::Process(v.message),
            Error::Sde(v) => ComputationError::Sde(v.message),
            Error::SearchError(v) => ComputationError::SearchError(v.try_into()?),
            Error::SessionCreatingFail(..) => ComputationError::SessionCreatingFail,
            Error::SessionUnavailable(..) => ComputationError::SessionUnavailable,
            Error::Protocol(v) => ComputationError::Protocol(v.message),
        })
    }
}

#[derive(Error, Debug, Serialize, Deserialize)]
pub enum SearchError {
    #[error("Configuration error ({0})")]
    Config(String),
    #[error("Channel-Communication error ({0})")]
    Communication(String),
    #[error("IO error while grabbing: ({0})")]
    IoOperation(String),
    #[error("Regex-Error: ({0})")]
    Regex(String),
    //Regex(#[from] grep_regex::Error),
    #[error("Input-Error: ({0})")]
    Input(String),
    #[error("GrabError error ({0})")]
    Grab(#[from] GrabError),
    #[error("Aborted: ({0})")]
    Aborted(String),
}

impl TryFrom<error::SearchError> for SearchError {
    type Error = E;
    fn try_from(v: error::SearchError) -> Result<Self, Self::Error> {
        use error::search_error::Error;
        let err = v.error.ok_or(E::MissedField(String::from("error")))?;
        Ok(match err {
            Error::IoOperation(v) => SearchError::IoOperation(v.message),
            Error::Input(v) => SearchError::Input(v.message),
            Error::Aborted(v) => SearchError::Aborted(v.message),
            Error::Communication(v) => SearchError::Communication(v.message),
            Error::Config(v) => SearchError::Config(v.message),
            Error::Regex(v) => SearchError::Regex(v.message),
            Error::Grab(v) => SearchError::Grab(
                v.error
                    .ok_or(E::MissedField(String::from("error")))?
                    .try_into()?,
            ),
        })
    }
}

#[derive(Error, Debug, Serialize, Deserialize)]
pub enum GrabError {
    #[error("Configuration error ({0})")]
    Config(String),
    #[error("Channel-Communication error ({0})")]
    Communication(String),
    #[error("IO error while grabbing: ({0})")]
    IoOperation(String),
    #[error("Invalid range: ({range:?}) ({context})")]
    InvalidRange {
        range: RangeInclusive<u64>,
        context: String,
    },
    #[error("Grabber interrupted")]
    Interrupted,
    #[error("Metadata initialization not done")]
    NotInitialize,
    #[error("Unsupported file type: {0}")]
    Unsupported(String),
}

impl TryFrom<error::GrabError> for GrabError {
    type Error = E;
    fn try_from(v: error::GrabError) -> Result<Self, Self::Error> {
        use error::grab_error::Error;

        let err = v.error.ok_or(E::MissedField(String::from("error")))?;
        Ok(match err {
            Error::Unsupported(v) => GrabError::Unsupported(v.message),
            Error::NotInitialize(..) => GrabError::NotInitialize,
            Error::Interrupted(..) => GrabError::Interrupted,
            Error::IoOperation(v) => GrabError::IoOperation(v.message),
            Error::Config(v) => GrabError::Config(v.message),
            Error::Communication(v) => GrabError::Communication(v.message),
            Error::InvalidRange(v) => {
                let range = v.range.ok_or(E::MissedField(String::from("range")))?;
                GrabError::InvalidRange {
                    range: RangeInclusive::new(range.start, range.end),
                    context: v.context,
                }
            }
        })
    }
}

#[wasm_bindgen]
pub fn decode(buf: &[u8]) -> Result<JsValue, E> {
    let cb_event: ComputationError = error::ComputationError::decode(buf)?.try_into()?;
    Ok(to_value(&cb_event)?)
}
