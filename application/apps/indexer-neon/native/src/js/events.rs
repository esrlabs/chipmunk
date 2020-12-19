use crossbeam_channel as cc;
use indexer_base::progress::Progress;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(strum_macros::ToString, Debug, Serialize, Deserialize)]
pub enum CallbackEvent {
    Progress(Progress),
    Notification,
    Done(Done),
}

#[derive(strum_macros::ToString, Debug, Serialize, Deserialize)]
pub enum Done {
    Finished,
    Interrupted,
}

#[derive(Error, Debug)]
pub enum ComputationError {
    #[error("Native communication error ({0})")]
    Communication(String),
    #[error("Operation not supported ({0})")]
    OperationNotSupported(String),
    #[error("IO error ({0})")]
    IoOperation(#[from] std::io::Error),
    #[error("Invalid data error")]
    InvalidData,
    #[error("Error during processing: ({0})")]
    Process(String),
    #[error("Wrong usage of API: ({0})")]
    Protocol(String),
}

pub type Channel<T> = (cc::Sender<T>, cc::Receiver<T>);
pub type ShutdownReceiver = cc::Receiver<()>;
