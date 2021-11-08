use crate::js::{
    handlers,
    session::{
        events::{CallbackEvent, ComputationError, NativeError, NativeErrorKind, OperationDone},
        state::SessionStateAPI,
        SupportedFileType,
    },
};
use crossbeam_channel as cc;
use indexer_base::progress::Severity;
use log::{error, warn};
use merging::{concatenator::ConcatenatorInput, merger::FileMergeOptions};
use processor::{grabber::GrabMetadata, map::NearestPosition, search::SearchFilter};
use serde::Serialize;
use std::path::PathBuf;
use tokio::{
    sync::{mpsc::UnboundedSender, oneshot},
    task::spawn,
};
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

pub type OperationResult<T> = Result<Option<T>, NativeError>;

pub enum OperationCallback {
    CallbackEvent(CallbackEvent),
    AddOperation((Uuid, CancellationToken, oneshot::Sender<bool>)),
    RemoveOperation((Uuid, oneshot::Sender<()>)),
    Cancel((Uuid, Uuid)),
}

#[derive(Clone)]
pub struct OperationAPI {
    tx_callback_events: UnboundedSender<OperationCallback>,
    operation_id: Uuid,
    cancellation_token: CancellationToken,
}

impl OperationAPI {
    pub fn new(
        tx_callback_events: UnboundedSender<OperationCallback>,
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
        if let Err(err) = self
            .tx_callback_events
            .send(OperationCallback::CallbackEvent(event))
        {
            error!("Fail to send event {}; error: {}", event_log, err)
        }
    }

    pub async fn finish<T>(&self, result: OperationResult<T>)
    where
        T: Serialize + std::fmt::Debug,
    {
        let event = match result {
            Ok(result) => {
                if let Some(result) = result.as_ref() {
                    match serde_json::to_string(result) {
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
                    }
                } else {
                    CallbackEvent::OperationDone(OperationDone {
                        uuid: self.operation_id,
                        result: None,
                    })
                }
            }
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
        if let Err(err) = self.unregister().await {
            error!("Fail to unrigister operation; error: {:?}", err);
        }
        self.emit(event);
    }

    pub fn get_cancellation_token(&self) -> CancellationToken {
        self.cancellation_token.child_token()
    }

    pub async fn register(&self) -> Result<bool, NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<bool>, oneshot::Receiver<bool>) =
            oneshot::channel();
        self.tx_callback_events
            .send(OperationCallback::AddOperation((
                self.id(),
                self.get_cancellation_token(),
                tx_response,
            )))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some(format!(
                    "fail to add operation {} because error: {}",
                    self.id(),
                    e
                )),
            })?;
        Ok(rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ComputationFailed,
            message: Some(format!(
                "fail to get response for add operation {}",
                self.id(),
            )),
        })?)
    }

    pub async fn process(
        &self,
        operation: Operation,
        state: SessionStateAPI,
        search_metadata_tx: cc::Sender<Option<(PathBuf, GrabMetadata)>>,
    ) -> Result<(), NativeError> {
        let added = self.register().await?;
        if !added {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some(format!("Operation {} already exists", self.id())),
            });
        }
        match operation {
            Operation::Assign {
                file_path,
                source_id,
                source_type,
            } => {
                self.finish(
                    handlers::assign::handle(&self, &file_path, source_type, source_id, state)
                        .await,
                )
                .await;
            }
            Operation::Search {
                target_file,
                filters,
            } => {
                self.finish(
                    handlers::search::handle(
                        &self,
                        target_file,
                        filters,
                        &search_metadata_tx,
                        state,
                    )
                    .await,
                )
                .await;
            }
            Operation::Extract {
                target_file,
                filters,
            } => {
                self.finish(handlers::extract::handle(&target_file, filters.iter()))
                    .await;
            }
            Operation::Map { dataset_len, range } => {
                self.finish(Ok(Some(
                    state.get_search_map().await?.scaled(dataset_len, range),
                )))
                .await;
            }
            Operation::Concat {
                files,
                out_path,
                append,
                source_type,
                source_id,
            } => {
                self.finish(
                    handlers::concat::handle(
                        &self,
                        files,
                        &out_path,
                        append,
                        source_type,
                        source_id,
                        state,
                    )
                    .await,
                )
                .await;
            }
            Operation::Merge {
                files,
                out_path,
                append,
                source_type,
                source_id,
            } => {
                self.finish(
                    handlers::merge::handle(
                        &self,
                        files,
                        &out_path,
                        append,
                        source_type,
                        source_id,
                        state,
                    )
                    .await,
                )
                .await;
            }
            Operation::Cancel { operation_id } => {
                // debug!("RUST: received cancel operation event");
                // if let Some(token) = operations.remove(&operation_id) {
                //     token.cancel();
                //     operation_api.finish::<OperationResult<()>>(Ok(None));
                // } else {
                //     operation_api.emit(CallbackEvent::OperationError {
                //         uuid: operation_id,
                //         error: NativeError {
                //             severity: Severity::WARNING,
                //             kind: NativeErrorKind::NotYetImplemented,
                //             message: Some(format!("Operation {} isn't found", operation_id)),
                //         },
                //     });
                // }
            }
            Operation::ExtractMetadata(tx_response) => {
                if let Err(err) = tx_response.send(if let Some(md) = &state.get_metadata().await? {
                    let md = md.clone();
                    state.set_metadata(None).await?;
                    Some(md)
                } else {
                    None
                }) {
                    error!(
                        "fail to responce to Operation::ExtractMetadata; error: {}",
                        err
                    );
                }
                self.finish::<OperationResult<()>>(Ok(None)).await;
            }
            Operation::DropSearch(tx_response) => {
                state.set_matches(None).await?;
                if let Err(err) = tx_response.send(()) {
                    error!("fail to responce to Operation::DropSearch; error: {}", err);
                }
                self.finish::<OperationResult<()>>(Ok(None)).await;
            }
            Operation::GetNearestPosition((position, tx_response)) => {
                if let Err(err) =
                    tx_response.send(state.get_search_map().await?.nearest_to(position))
                {
                    error!(
                        "fail to responce to Operation::GetNearestPosition; error: {}",
                        err
                    );
                }
                self.finish::<OperationResult<()>>(Ok(None)).await;
            }
            Operation::End => {
                self.emit(CallbackEvent::SessionDestroyed);
            }
        };
        Ok(())
    }

    async fn unregister(&self) -> Result<(), NativeError> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        self.tx_callback_events
            .send(OperationCallback::RemoveOperation((self.id(), tx_response)))
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some(format!(
                    "fail to remove operation {} because error: {}",
                    self.id(),
                    e
                )),
            })?;
        rx_response.await.map_err(|_| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::ComputationFailed,
            message: Some(format!(
                "fail to get response for remove operation {}",
                self.id(),
            )),
        })?;
        Ok(())
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
