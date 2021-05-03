use crossbeam_channel as cc;
use indexer_base::progress::Progress;
use indexer_base::progress::Severity;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::{broadcast, mpsc, oneshot};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub enum NativeErrorKind {
    /// The file in question does not exist
    FileNotFound,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NativeError {
    severity: Severity,
    kind: NativeErrorKind,
}

#[derive(strum_macros::ToString, Debug, Serialize, Deserialize)]
pub enum CallbackEvent {
    /**
     * Triggered on update of stream (session) file
     * @event StreamUpdated { rows: usize }
     * rows - count of rows, which can be requested with method [grab]
     * >> Scope: session
     * >> Kind: repeated
     */
    StreamUpdated(u64),
    /**
     * Triggered on update of search result data
     * @event SearchUpdated { rows: usize }
     * rows - count of rows, which can be requested with method [grabSearchResult]
     * >> Scope: session
     * >> Kind: repeated
     */
    SearchUpdated(u64),
    /**
     * Triggered on progress of async operation
     * @event Progress: { total: usize, done: usize }
     * >> Scope: async operation
     * >> Kind: repeated
     */
    Progress((Uuid, Progress)),
    /**
     * Triggered on error in the scope of session
     * >> Scope: session
     * >> Kind: repeated
     */
    SessionError(NativeError),
    /**
     * Triggered on error in the scope proccessing an async operation
     * >> Scope: session, async operation
     * >> Kind: repeated
     */
    OperationError((Uuid, NativeError)),
    /**
     * Triggered on some asynch operation is done
     * >> Scope: async operation
     * >> Kind: repeated
     */
    OperationDone(Uuid),

    /**
     * Triggered on session is destroyed
     * >> Scope: session
     * >> Kind: once
     */
    SessionDestroyed,
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

pub type SyncChannel<T> = (cc::Sender<T>, cc::Receiver<T>);
pub type AsyncChannel<T> = (mpsc::Sender<T>, mpsc::Receiver<T>);
pub type AsyncOneshotChannel<T> = (oneshot::Sender<T>, oneshot::Receiver<T>);
pub type AsyncBroadcastChannel<T> = (broadcast::Sender<T>, broadcast::Receiver<T>);
// pub type ShutdownReceiver = cc::Receiver<()>;
