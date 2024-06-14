use crate::{
    progress::{Progress, Severity, Ticks},
    state::AttachmentInfo,
};
use crossbeam_channel as cc;
use plugins::PluginHostInitError;
use processor::{grabber::GrabError, search::error::SearchError};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use uuid::Uuid;

use crate::state::{attachments::AttachmentsError, values::ValuesError};

#[derive(Debug, Serialize, Deserialize, Clone)]
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
    ChannelError,
    Io,
    Grabber,
    Plugins,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NativeError {
    pub severity: Severity,
    pub kind: NativeErrorKind,
    pub message: Option<String>,
}

impl NativeError {
    pub fn channel(msg: &str) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ChannelError,
            message: Some(String::from(msg)),
        }
    }
}

impl From<AttachmentsError> for NativeError {
    fn from(err: AttachmentsError) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(err.to_string()),
        }
    }
}

impl From<ValuesError> for NativeError {
    fn from(err: ValuesError) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(err.to_string()),
        }
    }
}

impl From<ComputationError> for NativeError {
    fn from(err: ComputationError) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(err.to_string()),
        }
    }
}

impl From<std::io::Error> for NativeError {
    fn from(err: std::io::Error) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(err.to_string()),
        }
    }
}

impl From<sources::Error> for NativeError {
    fn from(err: sources::Error) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ComputationFailed,
            message: Some(format!("Fail create source: {err}")),
        }
    }
}

impl From<tokio::sync::mpsc::error::SendError<CallbackEvent>> for NativeError {
    fn from(err: tokio::sync::mpsc::error::SendError<CallbackEvent>) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ComputationFailed,
            message: Some(format!("Callback channel is broken: {err}")),
        }
    }
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
            GrabError::Unsupported(s) => NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some(format!("File type is not supported: {s}")),
            },
        }
    }
}

impl From<PluginHostInitError> for NativeError {
    fn from(err: PluginHostInitError) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Plugins,
            message: Some(format!("Plugin initializations failed. Error: {err}")),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationDone {
    pub uuid: Uuid,
    pub result: Option<String>,
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
     * Triggered on file has been read complitely. After this event session starts tail
     * @event FileRead
     * >> Scope: session
     * >> Kind: once
     */
    FileRead,
    /**
     * Triggered on update of search result data
     * @event SearchUpdated { rows: usize }
     * rows - count of rows, which can be requested with method [grabSearchResult]
     * >> Scope: session
     * >> Kind: repeated
     */
    SearchUpdated {
        found: u64,
        stat: HashMap<String, u64>,
    },
    /**
     * Triggered on update of indexed map
     * @event IndexedMapUpdated { len: u64 }
     * len - count of rows, which can be requested with method [grabSearchResult]
     * >> Scope: session
     * >> Kind: repeated
     */
    IndexedMapUpdated { len: u64 },
    /**
     * Triggered on update of search result data
     * @event SearchMapUpdated { Option<String> }
     * includes JSON String of Vec<u64> - map of all matches in search
     * also called with each search update if there are streaming
     * None - map is dropped
     * >> Scope: session
     * >> Kind: repeated
     */
    SearchMapUpdated(Option<String>),
    /**
     * Triggered on update of search values data. Used for charts
     * @event SearchValuesUpdated
     * in search with values also called with each search update if there are streaming
     * true - map is dropped
     * >> Scope: session
     * >> Kind: repeated
     */
    SearchValuesUpdated(Option<HashMap<u8, (f64, f64)>>),
    /**
     * Triggered with new attachment has been detected
     * len - number of already detected attachments (in session)
     * uuid - UUID of new attachment
     * >> Scope: async operation
     * >> Kind: repeated
     */
    AttachmentsUpdated {
        len: u64,
        attachment: AttachmentInfo,
    },
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
     * Operations is created; task is spawned.
     * This even is triggered always
     * Triggered on all continues asynch operation like observe
     * >> Scope: async operation
     * >> Kind: repeated
     */
    OperationStarted(Uuid),
    /**
     * All initializations are done and operation is processing now.
     * There are no guarantees an event would be triggered. It depends
     * on each specific operation. This event can be triggered multiple
     * times in the scope of one operation (for example concat).
     * Could be triggered on continues asynch operation like observe
     * >> Scope: async operation
     * >> Kind: repeated
     */
    OperationProcessing(Uuid),
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

impl CallbackEvent {
    pub fn no_search_results() -> Self {
        CallbackEvent::SearchUpdated {
            found: 0,
            stat: HashMap::new(),
        }
    }

    pub fn search_results(found: u64, stat: HashMap<String, u64>) -> Self {
        CallbackEvent::SearchUpdated { found, stat }
    }
}

impl std::fmt::Display for CallbackEvent {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            Self::StreamUpdated(len) => write!(f, "StreamUpdated({len})"),
            Self::FileRead => write!(f, "FileRead"),
            Self::SearchUpdated { found, stat: _ } => write!(f, "SearchUpdated({found})"),
            Self::IndexedMapUpdated { len } => write!(f, "IndexedMapUpdated({len})"),
            Self::SearchMapUpdated(_) => write!(f, "SearchMapUpdated"),
            Self::SearchValuesUpdated(_) => write!(f, "SearchValuesUpdated"),
            Self::AttachmentsUpdated { len, attachment: _ } => {
                write!(f, "AttachmentsUpdated: {}", len)
            }
            Self::Progress {
                uuid: _,
                progress: _,
            } => write!(f, "Progress"),
            Self::SessionError(err) => write!(f, "SessionError: {err:?}"),
            Self::OperationError { uuid, error } => {
                write!(f, "OperationError: {uuid}: {error:?}")
            }
            Self::OperationStarted(uuid) => write!(f, "OperationStarted: {uuid}"),
            Self::OperationProcessing(uuid) => write!(f, "OperationProcessing: {uuid}"),
            Self::OperationDone(info) => write!(f, "OperationDone: {}", info.uuid),
            Self::SessionDestroyed => write!(f, "SessionDestroyed"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum LifecycleTransition {
    Started { uuid: Uuid, alias: String },
    Ticks { uuid: Uuid, ticks: Ticks },
    Stopped(Uuid),
}

impl LifecycleTransition {
    pub fn uuid(&self) -> Uuid {
        match self {
            Self::Started { uuid, alias: _ } => *uuid,
            Self::Ticks { uuid, ticks: _ } => *uuid,
            Self::Stopped(uuid) => *uuid,
        }
    }

    pub fn started(uuid: &Uuid, alias: &str) -> Self {
        LifecycleTransition::Started {
            uuid: *uuid,
            alias: alias.to_owned(),
        }
    }

    pub fn stopped(uuid: &Uuid) -> Self {
        LifecycleTransition::Stopped(*uuid)
    }

    pub fn ticks(uuid: &Uuid, ticks: Ticks) -> Self {
        LifecycleTransition::Ticks { uuid: *uuid, ticks }
    }
}

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
    NativeError(NativeError),
    #[error("Grabbing content not possible: {0:?}")]
    Grabbing(#[from] GrabError),
    #[error("Sending data to source error: {0:?}")]
    Sde(String),
}

pub type SyncChannel<T> = (cc::Sender<T>, cc::Receiver<T>);
