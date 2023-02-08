use crate::{
    events::{CallbackEvent, ComputationError, NativeError, NativeErrorKind, OperationDone},
    handlers,
    state::SessionStateAPI,
    tracker::OperationTrackerAPI,
};
use indexer_base::progress::Severity;
use log::{debug, error, warn};
use merging::{concatenator::ConcatenatorInput, merger::FileMergeOptions};
use processor::search::filter::SearchFilter;
use serde::Serialize;
use sources::{
    factory::ObserveOptions,
    producer::{SdeReceiver, SdeSender},
};
use std::{
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use tokio::{
    sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
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
#[allow(clippy::large_enum_variant)]
pub enum OperationKind {
    Observe(ObserveOptions),
    Search {
        filters: Vec<SearchFilter>,
    },
    Export {
        out_path: PathBuf,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
    },
    ExportRaw {
        out_path: PathBuf,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
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
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                OperationKind::Observe(_) => "Observe",
                OperationKind::Search { .. } => "Search",
                OperationKind::Export { .. } => "Export",
                OperationKind::ExportRaw { .. } => "Export",
                OperationKind::Extract { .. } => "Extract",
                OperationKind::Map { .. } => "Map",
                OperationKind::Concat { .. } => "Concat",
                OperationKind::Merge { .. } => "Merge",
                OperationKind::Sleep(_) => "Sleep",
                OperationKind::Cancel { .. } => "Cancel",
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
    // Used to force cancellation
    cancellation_token: CancellationToken,
    // Uses to confirm cancellation / done state of operation
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

    pub fn done_token(&self) -> CancellationToken {
        self.done_token.clone()
    }

    pub fn emit(&self, event: CallbackEvent) {
        let event_log = format!("{event:?}");
        if let Err(err) = self.tx_callback_events.send(event) {
            error!("Fail to send event {}; error: {}", event_log, err)
        }
    }

    pub fn started(&self) {
        self.emit(CallbackEvent::OperationStarted(self.id()));
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
                                message: Some(format!("{err}")),
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
        if !self.state_api.is_closing() && !self.cancellation_token().is_cancelled() {
            if let Err(err) = self.tracker_api.remove_operation(self.id()).await {
                error!("Failed to remove operation; error: {:?}", err);
            }
        }
        debug!("Operation \"{}\" ({}) finished", alias, self.id());
        self.emit(event);
        // Confirm finishing of operation
        self.done_token.cancel();
    }

    pub fn cancellation_token(&self) -> CancellationToken {
        self.cancellation_token.clone()
    }

    pub async fn execute(
        &self,
        operation: Operation,
        tx_sde: Option<SdeSender>,
        rx_sde: Option<SdeReceiver>,
    ) -> Result<(), NativeError> {
        let added = self
            .tracker_api
            .add_operation(
                self.id(),
                operation.kind.to_string(),
                tx_sde,
                self.cancellation_token(),
                self.done_token(),
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
                OperationKind::Observe(options) => {
                    api.finish(
                        handlers::observe::handle(api.clone(), state, options, rx_sde).await,
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
                OperationKind::Export { out_path, ranges } => {
                    api.finish(
                        handlers::export::handle(&api, state, out_path, ranges).await,
                        operation_str,
                    )
                    .await;
                }
                OperationKind::ExportRaw { out_path, ranges } => {
                    api.finish(
                        handlers::export_raw::handle(&api, state, out_path, ranges).await,
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
                OperationKind::Map { dataset_len, range } => {
                    match state.get_scaled_map(dataset_len, range).await {
                        Ok(map) => {
                            api.finish(Ok(Some(map)), operation_str).await;
                        }
                        Err(err) => {
                            api.finish::<OperationResult<()>>(Err(err), operation_str)
                                .await;
                        }
                    }
                }
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
                                        "Fail to cancel operation {target}; operation isn't found"
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
                                    "Fail to cancel operation {target}; error: {err:?}"
                                )),
                            }),
                            operation_str,
                        )
                        .await;
                    }
                },
                OperationKind::GetNearestPosition(position) => {
                    match state.get_nearest_position(position).await {
                        Ok(nearest) => {
                            api.finish(Ok(nearest), operation_str).await;
                        }
                        Err(err) => {
                            api.finish::<OperationResult<()>>(Err(err), operation_str)
                                .await;
                        }
                    }
                }
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
            "Fail to parse operation uuid from {operation_id}. Error: {e}"
        ))),
    }
}

pub async fn run(
    mut rx_operations: UnboundedReceiver<Operation>,
    state_api: SessionStateAPI,
    tracker_api: OperationTrackerAPI,
    tx_callback_events: UnboundedSender<CallbackEvent>,
) -> Result<(), NativeError> {
    debug!("task is started");
    while let Some(operation) = rx_operations.recv().await {
        if !matches!(operation.kind, OperationKind::End) {
            let operation_api = OperationAPI::new(
                state_api.clone(),
                tracker_api.clone(),
                tx_callback_events.clone(),
                operation.id,
                CancellationToken::new(),
            );
            let (tx_sde, rx_sde): (Option<SdeSender>, Option<SdeReceiver>) =
                if matches!(operation.kind, OperationKind::Observe(..)) {
                    let (tx_sde, rx_sde): (SdeSender, SdeReceiver) = unbounded_channel();
                    (Some(tx_sde), Some(rx_sde))
                } else {
                    (None, None)
                };
            if let Err(err) = operation_api.execute(operation, tx_sde, rx_sde).await {
                operation_api.emit(CallbackEvent::OperationError {
                    uuid: operation_api.id(),
                    error: err,
                });
            }
        } else {
            debug!("session closing is requested");
            break;
        }
    }
    state_api.close_session().await?;
    if let Err(err) = tracker_api.shutdown() {
        error!("Failed to shutdown tracker: {:?}", err);
    }
    debug!("operations task finished");
    Ok(())
}
