use crossbeam_channel as cc;
use thiserror::Error;

#[derive(strum_macros::ToString, Debug)]
pub enum CallbackEvent {
    Progress,
    Notification,
    Done,
}

#[derive(Error, Debug)]
pub enum ComputationError {
    #[error("Native communication error ({0})")]
    Communication(String),
    #[error("Operation not supported ({0})")]
    OperationNotSupported(String),
    #[error("IO error ({0})")]
    IoOperation(#[from] std::io::Error),
}

pub type Channel<T> = (cc::Sender<T>, cc::Receiver<T>);
pub type ShutdownReceiver = cc::Receiver<()>;
