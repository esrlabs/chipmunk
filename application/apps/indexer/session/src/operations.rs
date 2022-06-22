use crate::{
    events::{CallbackEvent, ComputationError, NativeError, NativeErrorKind, OperationDone},
    handlers,
    state::SessionStateAPI,
    tracker::OperationTrackerAPI,
};
use indexer_base::progress::Severity;
use log::{debug, error, warn};
use merging::{concatenator::ConcatenatorInput, merger::FileMergeOptions};
use processor::search::SearchFilter;
use serde::Serialize;
use sources::factory::SourceType;
use std::{
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::{
    sync::mpsc::{UnboundedReceiver, UnboundedSender},
    task::spawn,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct OperationStat {
    pub uuid: String,
    pub name: String,
    pub duration: u64,
    pub started: u64,
}

impl OperationStat {
    pub fn new(uuid: String, name: String) -> Self {
        let start = SystemTime::now();
        let timestamp = match start.duration_since(UNIX_EPOCH) {
            Ok(timestamp) => timestamp.as_micros() as u64,
            Err(err) => {
                error!("Failed to get timestamp: {}", err);
                0
            }
        };
        OperationStat {
            uuid,
            name,
            started: timestamp,
            duration: 0,
        }
    }
    pub fn done(&mut self) {
        let start = SystemTime::now();
        let timestamp = match start.duration_since(UNIX_EPOCH) {
            Ok(timestamp) => timestamp.as_micros() as u64,
            Err(err) => {
                error!("Failed to get timestamp: {}", err);
                0
            }
        };
        if timestamp > self.started {
            self.duration = timestamp - self.started;
        }
    }
}

#[derive(Debug)]
pub struct Operation {
    kind: OperationKind,
    id: Uuid,
}

impl Operation {
    pub fn new(id: Uuid, kind: OperationKind) -> Self {
        Operation { kind, id }
    }
}

#[derive(Debug)]
pub enum OperationKind {
    Observe(SourceType),
    Search {
        filters: Vec<SearchFilter>,
    },
    Extract {
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
        source_id: String,
    },
    Merge {
        files: Vec<FileMergeOptions>,
        out_path: PathBuf,
        append: bool,
        source_id: String,
    },
    GetNearestPosition(u64),
    Cancel {
        target: Uuid,
    },
    Sleep(u64),
    End,
}

impl std::fmt::Display for OperationKind {
    // This trait requires `fmt` with this exact signature.
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                OperationKind::Observe(_) => "Observe",
                OperationKind::Search { filters: _ } => "Search",
                OperationKind::Extract { filters: _ } => "Extract",
                OperationKind::Map {
                    dataset_len: _,
                    range: _,
                } => "Map",
                OperationKind::Concat {
                    files: _,
                    out_path: _,
                    append: _,
                    source_id: _,
                } => "Concat",
                OperationKind::Merge {
                    files: _,
                    out_path: _,
                    append: _,
                    source_id: _,
                } => "Merge",
                OperationKind::Sleep(_) => "Sleep",
                OperationKind::Cancel { target: _ } => "Cancel",
                OperationKind::GetNearestPosition(_) => "GetNearestPosition",
                OperationKind::End => "End",
            }
        )
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct NoOperationResults;

pub type OperationResult<T> = Result<Option<T>, NativeError>;

#[derive(Clone)]
pub struct OperationAPI {
    tx_callback_events: UnboundedSender<CallbackEvent>,
    operation_id: Uuid,
    state_api: SessionStateAPI,
    tracker_api: OperationTrackerAPI,
    // Used to force cancalation
    cancellation_token: CancellationToken,
    // Uses to confirm cancaltion / done state of operation
    done_token: CancellationToken,
}

impl OperationAPI {
    pub fn new(
        state_api: SessionStateAPI,
        tracker_api: OperationTrackerAPI,
        tx_callback_events: UnboundedSender<CallbackEvent>,
        operation_id: Uuid,
        cancellation_token: CancellationToken,
    ) -> Self {
        OperationAPI {
            tx_callback_events,
            operation_id,
            cancellation_token,
            done_token: CancellationToken::new(),
            state_api,
            tracker_api,
        }
    }

    pub fn id(&self) -> Uuid {
        self.operation_id
    }

    pub fn get_done_token(&self) -> CancellationToken {
        self.done_token.clone()
    }

    pub fn emit(&self, event: CallbackEvent) {
        let event_log = format!("{:?}", event);
        if let Err(err) = self.tx_callback_events.send(event) {
            error!("Fail to send event {}; error: {}", event_log, err)
        }
    }

    pub async fn finish<T>(&self, result: OperationResult<T>, alias: &str)
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
        if !self.state_api.is_closing() && !self.get_cancellation_token().is_cancelled() {
            if let Err(err) = self.tracker_api.remove_operation(self.id()).await {
                error!("Failed to remove operation; error: {:?}", err);
            }
        }
        debug!("Operation \"{}\" ({}) finished", alias, self.id());
        self.emit(event);
        // Confirm finishing of operation
        self.done_token.cancel();
    }

    pub fn get_cancellation_token(&self) -> CancellationToken {
        self.cancellation_token.clone()
    }

    pub fn get_cancellation_token_listener(&self) -> CancellationToken {
        self.cancellation_token.child_token()
    }

    pub async fn execute(&self, operation: Operation) -> Result<(), NativeError> {
        let added = self
            .tracker_api
            .add_operation(
                self.id(),
                operation.kind.to_string(),
                self.get_cancellation_token(),
                self.get_done_token(),
            )
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
        let tracker = self.tracker_api.clone();
        spawn(async move {
            let operation_str = &format!("{}", operation.kind);
            match operation.kind {
                OperationKind::Observe(source) => {
                    api.finish(
                        handlers::observe::handle(api.clone(), state, source).await,
                        operation_str,
                    )
                    .await;
                }
                OperationKind::Search { filters } => {
                    api.finish(
                        handlers::search::handle(&api, filters, state).await,
                        operation_str,
                    )
                    .await;
                }
                OperationKind::Extract { filters } => {
                    let session_file = match state.get_session_file().await {
                        Ok(session_file) => session_file,
                        Err(err) => {
                            warn!("Fail to call OperationKind::Extract; error: {:?}", err);
                            return;
                        }
                    };
                    api.finish(
                        handlers::extract::handle(&session_file, filters.iter()),
                        operation_str,
                    )
                    .await;
                }
                OperationKind::Map { dataset_len, range } => match state.get_search_map().await {
                    Ok(map) => {
                        api.finish(Ok(Some(map.scaled(dataset_len, range))), operation_str)
                            .await;
                    }
                    Err(err) => {
                        api.finish::<OperationResult<()>>(Err(err), operation_str)
                            .await;
                    }
                },
                OperationKind::Concat {
                    files,
                    out_path,
                    append,
                    source_id,
                } => {
                    api.finish(
                        handlers::concat::handle(&api, files, &out_path, append, source_id, state)
                            .await,
                        operation_str,
                    )
                    .await;
                }
                OperationKind::Merge {
                    files,
                    out_path,
                    append,
                    source_id,
                } => {
                    api.finish(
                        handlers::merge::handle(&api, files, &out_path, append, source_id, state)
                            .await,
                        operation_str,
                    )
                    .await;
                }
                OperationKind::Sleep(ms) => {
                    api.finish(handlers::sleep::handle(&api, ms).await, operation_str)
                        .await;
                }
                OperationKind::Cancel { target } => match tracker.cancel_operation(target).await {
                    Ok(canceled) => {
                        if canceled {
                            api.finish::<OperationResult<()>>(Ok(None), operation_str)
                                .await;
                        } else {
                            api.finish::<OperationResult<()>>(
                                Err(NativeError {
                                    severity: Severity::WARNING,
                                    kind: NativeErrorKind::NotYetImplemented,
                                    message: Some(format!(
                                        "Fail to cancel operation {}; operation isn't found",
                                        target
                                    )),
                                }),
                                operation_str,
                            )
                            .await;
                        }
                    }
                    Err(err) => {
                        api.finish::<OperationResult<()>>(
                            Err(NativeError {
                                severity: Severity::WARNING,
                                kind: NativeErrorKind::NotYetImplemented,
                                message: Some(format!(
                                    "Fail to cancel operation {}; error: {:?}",
                                    target, err
                                )),
                            }),
                            operation_str,
                        )
                        .await;
                    }
                },
                OperationKind::GetNearestPosition(position) => match state.get_search_map().await {
                    Ok(map) => {
                        api.finish(Ok(Some(map.nearest_to(position))), operation_str)
                            .await;
                    }
                    Err(err) => {
                        api.finish::<OperationResult<()>>(Err(err), operation_str)
                            .await;
                    }
                },
                _ => {
                    // OperationKind::End is processing in the loop directly
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

pub async fn run(
    mut rx_operations: UnboundedReceiver<Operation>,
    state: SessionStateAPI,
    tracker: OperationTrackerAPI,
    tx_callback_events: UnboundedSender<CallbackEvent>,
) -> Result<(), NativeError> {
    debug!("task is started");
    while let Some(operation) = rx_operations.recv().await {
        if !matches!(operation.kind, OperationKind::End) {
            let operation_api = OperationAPI::new(
                state.clone(),
                tracker.clone(),
                tx_callback_events.clone(),
                operation.id,
                CancellationToken::new(),
            );
            if let Err(err) = operation_api.execute(operation).await {
                operation_api.emit(CallbackEvent::OperationError {
                    uuid: operation_api.id(),
                    error: err,
                });
            }
        } else {
            debug!("session closing is requested");
            state.close_session().await?;
            if let Err(err) = tracker.shutdown() {
                error!("Fail to shutdown tracker: {:?}", err);
            }
            break;
        }
    }
    debug!("task is finished");
    Ok(())
}
