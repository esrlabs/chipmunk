use crossbeam_channel as cc;
use indexer_base::{
    progress::{IndexingProgress, IndexingResults},
    utils,
};
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
}

pub type Channel<T> = (cc::Sender<T>, cc::Receiver<T>);
pub type ShutdownReceiver = cc::Receiver<()>;
