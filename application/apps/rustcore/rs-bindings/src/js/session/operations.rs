use crate::{
    js::{
        handlers,
        session::{
            events::{
                CallbackEvent, ComputationError, NativeError, NativeErrorKind, OperationDone,
            },
            state::SessionStateAPI,
            SupportedFileType,
        },
    },
    logging::targets,
};
use crossbeam_channel as cc;
use indexer_base::progress::Severity;
use log::{debug, error, warn};
use merging::{concatenator::ConcatenatorInput, merger::FileMergeOptions};
use processor::{grabber::GrabMetadata, map::NearestPosition, search::SearchFilter};
use serde::Serialize;
use std::path::PathBuf;
use tokio::{
    sync::mpsc::{UnboundedReceiver, UnboundedSender},
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

#[derive(Clone)]
pub struct OperationAPI {
    tx_callback_events: UnboundedSender<CallbackEvent>,
    operation_id: Uuid,
    cancellation_token: CancellationToken,
    state_api: SessionStateAPI,
}

impl OperationAPI {
    pub fn new(
        state_api: SessionStateAPI,
        tx_callback_events: UnboundedSender<CallbackEvent>,
        operation_id: Uuid,
        cancellation_token: CancellationToken,
    ) -> Self {
        OperationAPI {
            tx_callback_events,
            operation_id,
            cancellation_token,
            state_api,
        }
    }

    pub fn id(&self) -> Uuid {
        self.operation_id
    }

    pub fn emit(&self, event: CallbackEvent) {
        let event_log = format!("{:?}", event);
        if let Err(err) = self.tx_callback_events.send(event) {
            error!(
                target: targets::SESSION,
                "Fail to send event {}; error: {}", event_log, err
            )
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
                    target: targets::SESSION,
                    "Operation {} done with error: {:?}", self.operation_id, error
                );
                CallbackEvent::OperationError {
                    uuid: self.operation_id,
                    error,
                }
            }
        };
        if let Err(err) = self.state_api.remove_operation(self.id()).await {
            error!(
                target: targets::SESSION,
                "Fail to remove operation; error: {:?}", err
            );
        }
        self.emit(event);
    }

    pub fn get_cancellation_token(&self) -> CancellationToken {
        self.cancellation_token.child_token()
    }

    pub async fn process(
        &self,
        operation: Operation,
        search_metadata_tx: cc::Sender<Option<(PathBuf, GrabMetadata)>>,
    ) -> Result<(), NativeError> {
        let added = self
            .state_api
            .add_operation(self.id(), self.get_cancellation_token())
            .await?;
        if !added {
            return Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some(format!("Operation {} already exists", self.id())),
            });
        }
        let api = self.clone();
        let state = self.state_api.clone();
        spawn(async move {
            match operation {
                Operation::Assign {
                    file_path,
                    source_id,
                    source_type,
                } => {
                    api.finish(
                        handlers::assign::handle(&api, &file_path, source_type, source_id, state)
                            .await,
                    )
                    .await;
                }
                Operation::Search {
                    target_file,
                    filters,
                } => {
                    api.finish(
                        handlers::search::handle(
                            &api,
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
                    api.finish(handlers::extract::handle(&target_file, filters.iter()))
                        .await;
                }
                Operation::Map { dataset_len, range } => match state.get_search_map().await {
                    Ok(map) => {
                        api.finish(Ok(Some(map.scaled(dataset_len, range)))).await;
                    }
                    Err(err) => {
                        api.finish::<OperationResult<()>>(Err(err)).await;
                    }
                },
                Operation::Concat {
                    files,
                    out_path,
                    append,
                    source_type,
                    source_id,
                } => {
                    api.finish(
                        handlers::concat::handle(
                            &api,
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
                    api.finish(
                        handlers::merge::handle(
                            &api,
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
                    match state.cancel_operation(operation_id).await {
                        Ok(canceled) => {
                            if canceled {
                                api.finish::<OperationResult<()>>(Ok(None)).await;
                            } else {
                                api.finish::<OperationResult<()>>(Err(NativeError {
                                    severity: Severity::WARNING,
                                    kind: NativeErrorKind::NotYetImplemented,
                                    message: Some(format!(
                                        "Fail to cancel operation {}; operation isn't found",
                                        operation_id
                                    )),
                                }))
                                .await;
                            }
                        }
                        Err(err) => {
                            api.finish::<OperationResult<()>>(Err(NativeError {
                                severity: Severity::WARNING,
                                kind: NativeErrorKind::NotYetImplemented,
                                message: Some(format!(
                                    "Fail to cancel operation {}; error: {:?}",
                                    operation_id, err
                                )),
                            }))
                            .await;
                        }
                    }
                }
                Operation::ExtractMetadata(tx_response) => match state.get_metadata().await {
                    Ok(md) => {
                        if let Err(err) = tx_response.send(if let Some(md) = &md {
                            let md = md.clone();
                            if let Err(err) = state.set_metadata(None).await {
                                error!(
                                    target: targets::SESSION,
                                    "fail drop metadata; error: {:?}", err
                                );
                            }
                            Some(md)
                        } else {
                            None
                        }) {
                            error!(
                                target: targets::SESSION,
                                "fail to responce to Operation::ExtractMetadata; error: {}", err
                            );
                        }
                        api.finish::<OperationResult<()>>(Ok(None)).await;
                    }
                    Err(err) => {
                        api.finish::<OperationResult<()>>(Err(err)).await;
                    }
                },
                Operation::DropSearch(tx_response) => {
                    if let Err(err) = state.set_matches(None).await {
                        api.finish::<OperationResult<()>>(Err(err)).await;
                    } else {
                        if let Err(err) = tx_response.send(()) {
                            error!(
                                target: targets::SESSION,
                                "fail to responce to Operation::DropSearch; error: {}", err
                            );
                        }
                        api.finish::<OperationResult<()>>(Ok(None)).await;
                    }
                }
                Operation::GetNearestPosition((position, tx_response)) => {
                    match state.get_search_map().await {
                        Ok(map) => {
                            if let Err(err) = tx_response.send(map.nearest_to(position)) {
                                error!(
                                    target: targets::SESSION,
                                    "fail to responce to Operation::GetNearestPosition; error: {}",
                                    err
                                );
                            }
                            api.finish::<OperationResult<()>>(Ok(None)).await;
                        }
                        Err(err) => {
                            api.finish::<OperationResult<()>>(Err(err)).await;
                        }
                    }
                }
                Operation::End => {
                    debug!(target: targets::SESSION, "session closing is requested");
                }
            };
        });
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

pub async fn task(
    mut rx_operations: UnboundedReceiver<(Uuid, Operation)>,
    state: SessionStateAPI,
    search_metadata_tx: cc::Sender<Option<(PathBuf, GrabMetadata)>>,
    tx_callback_events: UnboundedSender<CallbackEvent>,
) -> Result<(), NativeError> {
    debug!(target: targets::SESSION, "task is started");
    while let Some((id, operation)) = rx_operations.recv().await {
        let operation_api = OperationAPI::new(
            state.clone(),
            tx_callback_events.clone(),
            id,
            CancellationToken::new(),
        );
        if matches!(operation, Operation::End) {
            state.close_session().await?;
            break;
        } else if let Err(err) = operation_api
            .process(operation, search_metadata_tx.clone())
            .await
        {
            operation_api.emit(CallbackEvent::OperationError {
                uuid: operation_api.id(),
                error: err,
            });
        }
    }
    debug!(target: targets::SESSION, "task is finished");
    Ok(())
}
