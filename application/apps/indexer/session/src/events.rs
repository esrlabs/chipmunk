use crossbeam_channel as cc;
use processor::{grabber::GrabError, search::error::SearchError};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
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
    NativeError(stypes::NativeError),
    #[error("Grabbing content not possible: {0:?}")]
    Grabbing(#[from] GrabError),
    #[error("Sending data to source error: {0:?}")]
    Sde(String),
}

impl From<ComputationError> for stypes::NativeError {
    fn from(err: ComputationError) -> Self {
        stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Io,
            message: Some(err.to_string()),
        }
    }
}

pub type SyncChannel<T> = (cc::Sender<T>, cc::Receiver<T>);
