use crate::js::{
    events::{CallbackEvent, ComputationError, NativeError, NativeErrorKind, OperationDone},
    session::SupportedFileType,
};
use crossbeam_channel as cc;
use indexer_base::progress::Severity;
use log::{debug, error, trace, warn};
use merging::{concatenator::ConcatenatorInput, merger::FileMergeOptions};
use processor::{grabber::GrabMetadata, map::NearestPosition, search::SearchFilter};
use serde::Serialize;
use std::path::PathBuf;
use tokio::sync::mpsc::UnboundedSender;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub enum Operation {
    Assign {
        file_path: PathBuf,
        source_id: String,
        source_type: SupportedFileType,
    },
    Search {
        target_file: PathBuf,
        filters: Vec<SearchFilter>,
    },
    Extract {
        target_file: PathBuf,
        filters: Vec<SearchFilter>,
    },
    Map {
        dataset_len: u16,
        range: Option<(u64, u64)>,
    },
    Concat {
        files: Vec<ConcatenatorInput>,
        out_path: PathBuf,
        append: bool,
        source_type: SupportedFileType,
        source_id: String,
    },
    Merge {
        files: Vec<FileMergeOptions>,
        out_path: PathBuf,
        append: bool,
        source_type: SupportedFileType,
        source_id: String,
    },
    ExtractMetadata(cc::Sender<Option<GrabMetadata>>),
    DropSearch(cc::Sender<()>),
    GetNearestPosition((u64, cc::Sender<Option<NearestPosition>>)),
    Cancel {
        operation_id: Uuid,
    },
    End,
}

#[derive(Debug, Serialize, Clone)]
pub struct NoOperationResults;

pub type OperationResult<T: Serialize + std::fmt::Debug> = Result<Option<T>, NativeError>;

pub struct OperationAPI {
    tx_callback_events: UnboundedSender<CallbackEvent>,
    operation_id: Uuid,
    cancellation_token: CancellationToken,
}

impl OperationAPI {
    pub fn new(
        tx_callback_events: UnboundedSender<CallbackEvent>,
        operation_id: Uuid,
        cancellation_token: CancellationToken,
    ) -> Self {
        OperationAPI {
            tx_callback_events,
            operation_id,
            cancellation_token,
        }
    }

    pub fn id(&self) -> Uuid {
        self.operation_id
    }

    pub fn emit(&self, event: CallbackEvent) {
        let event_log = format!("{:?}", event);
        if let Err(err) = self.tx_callback_events.send(event) {
            error!("Fail to send event {}; error: {}", event_log, err)
        }
    }

    pub fn finish<T>(&self, result: OperationResult<T>)
    where
        T: Serialize + std::fmt::Debug,
    {
        let event = match result {
            Ok(result) => match serde_json::to_string(&result) {
                Ok(serialized) => CallbackEvent::OperationDone(OperationDone {
                    uuid: self.operation_id,
                    result: Some(serialized),
                }),
                Err(err) => CallbackEvent::OperationError {
                    uuid: self.operation_id,
                    error: NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::ComputationFailed,
                        message: Some(format!("{}", err)),
                    },
                },
            },
            Err(error) => {
                warn!(
                    "Operation {} done with error: {:?}",
                    self.operation_id, error
                );
                CallbackEvent::OperationError {
                    uuid: self.operation_id,
                    error,
                }
            }
        };
        self.emit(event);
    }

    pub fn get_cancellation_token(&self) -> CancellationToken {
        self.cancellation_token.child_token()
    }
}

pub fn uuid_from_str(operation_id: &str) -> Result<Uuid, ComputationError> {
    match Uuid::parse_str(operation_id) {
        Ok(uuid) => Ok(uuid),
        Err(e) => Err(ComputationError::Process(format!(
            "Fail to parse operation uuid from {}. Error: {}",
            operation_id, e
        ))),
    }
}
