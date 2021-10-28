use crossbeam_channel as cc;
use indexer_base::progress::{Progress, Severity};
use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use processor::{
    grabber::GrabError,
    search::{FilterStats, SearchError},
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub enum NativeErrorKind {
    /// The file in question does not exist
    FileNotFound,
    /// The file type is not currently supported
    UnsupportedFileType,
    ComputationFailed,
    Configuration,
    Interrupted,
    OperationSearch,
    NotYetImplemented,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NativeError {
    pub severity: Severity,
    pub kind: NativeErrorKind,
    pub message: Option<String>,
}

impl From<GrabError> for NativeError {
    fn from(err: GrabError) -> Self {
        match err {
            GrabError::IoOperation(e) => NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some(e),
            },
            GrabError::Config(msg) => NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Configuration,
                message: Some(msg),
            },
            GrabError::Interrupted => NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Interrupted,
                message: None,
            },
            GrabError::InvalidRange { .. } => NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some("Invalid Range".to_string()),
            },
            GrabError::Communication(s) => NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some(s),
            },
            GrabError::NotInitialize => NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some("Grabbing failed, not initialized".to_owned()),
            },
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationDone {
    pub uuid: Uuid,
    pub result: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchOperationResult {
    pub found: usize,
    pub stats: FilterStats,
}

#[derive(Debug, Serialize, Deserialize)]
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
    Progress { uuid: Uuid, progress: Progress },
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
    OperationError { uuid: Uuid, error: NativeError },
    /**
     * Triggered on some asynch operation is done
     * >> Scope: async operation
     * >> Kind: repeated
     */
    OperationDone(OperationDone),

    /**
     * Triggered on session is destroyed
     * >> Scope: session
     * >> Kind: once
     */
    SessionDestroyed,
}

impl TryIntoJs for CallbackEvent {
    /// serialize into json object
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        match serde_json::to_string(&self) {
            Ok(s) => js_env.create_string_utf8(&s),
            Err(e) => Err(NjError::Other(format!(
                "Could not convert Callback event to json: {}",
                e
            ))),
        }
    }
}

#[derive(Error, Debug, Serialize)]
pub enum ComputationError {
    #[error("Attemp to call operation before assign a session")]
    NoAssignedContent,
    #[error("Native communication error ({0})")]
    Communication(String),
    #[error("Operation not supported ({0})")]
    OperationNotSupported(String),
    #[error("IO error ({0})")]
    IoOperation(String),
    #[error("Invalid data error")]
    InvalidData,
    #[error("Error during processing: ({0})")]
    Process(String),
    #[error("Wrong usage of API: ({0})")]
    Protocol(String),
    #[error("Search related error")]
    SearchError(SearchError),
}

impl TryIntoJs for ComputationError {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        let value = serde_json::to_value(&self).map_err(|e| NjError::Other(format!("{}", e)))?;
        value.try_to_js(js_env)
    }
}

pub type SyncChannel<T> = (cc::Sender<T>, cc::Receiver<T>);
// pub type AsyncChannel<T> = (mpsc::Sender<T>, mpsc::Receiver<T>);
// pub type AsyncOneshotChannel<T> = (oneshot::Sender<T>, oneshot::Receiver<T>);
pub type AsyncBroadcastChannel<T> = (broadcast::Sender<T>, broadcast::Receiver<T>);
// pub type ShutdownReceiver = cc::Receiver<()>;
