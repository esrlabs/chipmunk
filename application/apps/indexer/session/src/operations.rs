//! Operations definitions and their main functionalities, additionally it includes
//! Management of listening to incoming sessions then invoking them.

use crate::{handlers, state::SessionStateAPI, tracker::OperationTrackerAPI};
use futures::select;
use log::{debug, error, warn};
use merging::merger::FileMergeOptions;
use processor::search::filter::SearchFilter;
use serde::Serialize;
use sources::sde::{SdeReceiver, SdeSender};
use std::{
    ops::RangeInclusive,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use tokio::{
    sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel},
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
                error!("Failed to get timestamp: {err}");
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
                error!("Failed to get timestamp: {err}");
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
    Observe(stypes::ObserveOptions),
    Search {
        filters: Vec<SearchFilter>,
    },
    SearchValues {
        filters: Vec<String>,
    },
    /// Export operation containing parameters for exporting data.
    ///
    /// # Fields
    ///
    /// * `out_path` - The file system path where the exported data will be saved.
    /// * `ranges` - A vector of inclusive ranges specifying the segments of data to export.
    /// * `columns` - A vector of column indices indicating which columns to include in the export.
    /// * `spliter` - An optional string used as the record separator in session file to split log message to columns.
    /// * `delimiter` - An optional string used as the field delimiter within each record in output file.
    ///
    /// # Notes
    ///
    /// Exporting with considering selected columns (`columns`) will be done only if `spliter` and `delimiter` are
    /// defined. In all other cases, the export will save into `out_path` full log records.
    Export {
        /// The output path where the exported data will be written.
        out_path: PathBuf,
        /// The ranges of data to be exported, each defined as an inclusive range.
        ranges: Vec<std::ops::RangeInclusive<u64>>,
        /// The indices of the columns to include in the export.
        columns: Vec<usize>,
        /// An optional string used as the record separator in session file to split log message to columns. Defaults can be applied if `None`.
        spliter: Option<String>,
        /// An optional string used as the field delimiter within each record in output file. Defaults can be applied if `None`.
        delimiter: Option<String>,
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
    Values {
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
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
    Sleep(u64, bool),
    End,
}

impl std::fmt::Display for OperationKind {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                OperationKind::Observe(_) => "Observing",
                OperationKind::Search { .. } => "Searching",
                OperationKind::SearchValues { .. } => "Searching values",
                OperationKind::Export { .. } => "Exporting",
                OperationKind::ExportRaw { .. } => "Exporting as Raw",
                OperationKind::Extract { .. } => "Extracting",
                OperationKind::Map { .. } => "Mapping",
                OperationKind::Values { .. } => "Values",
                OperationKind::Merge { .. } => "Merging",
                OperationKind::Sleep(_, _) => "Sleeping",
                OperationKind::Cancel { .. } => "Canceling",
                OperationKind::GetNearestPosition(_) => "Getting nearest position",
                OperationKind::End => "End",
            }
        )
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct NoOperationResults;

pub type OperationResult<T> = Result<Option<T>, stypes::NativeError>;

#[derive(Clone)]
pub struct OperationAPI {
    tx_callback_events: UnboundedSender<stypes::CallbackEvent>,
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
        tx_callback_events: UnboundedSender<stypes::CallbackEvent>,
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

    pub fn emit(&self, event: stypes::CallbackEvent) {
        if let Err(err) = self.tx_callback_events.send(event) {
            let event_log = format!("{:?}", err.0);
            error!("Fail to send event {event_log}; error: {err}")
        }
    }

    pub fn started(&self) {
        self.emit(stypes::CallbackEvent::OperationStarted(self.id()));
    }

    pub fn processing(&self) {
        self.emit(stypes::CallbackEvent::OperationProcessing(self.id()));
    }

    pub async fn finish<T>(&self, result: OperationResult<T>, alias: &str)
    where
        T: Serialize + std::fmt::Debug,
    {
        let event = match result {
            Ok(result) => {
                if let Some(result) = result.as_ref() {
                    match stypes::serialize(result) {
                        Ok(bytes) => stypes::CallbackEvent::OperationDone(stypes::OperationDone {
                            uuid: self.operation_id,
                            result: Some(bytes),
                        }),
                        Err(err) => stypes::CallbackEvent::OperationError {
                            uuid: self.operation_id,
                            error: stypes::NativeError {
                                severity: stypes::Severity::ERROR,
                                kind: stypes::NativeErrorKind::ComputationFailed,
                                message: Some(format!("{err}")),
                            },
                        },
                    }
                } else {
                    stypes::CallbackEvent::OperationDone(stypes::OperationDone {
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
                stypes::CallbackEvent::OperationError {
                    uuid: self.operation_id,
                    error,
                }
            }
        };
        if !self.state_api.is_closing() && !self.cancellation_token().is_cancelled() {
            let id = self.id();
            if let Err(err) = self.tracker_api.remove_operation(id).await {
                error!("Failed to remove operation; error: {err:?}");
            }
        }
        debug!("Operation \"{alias}\" ({}) finished", self.id());
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
    ) -> Result<(), stypes::NativeError> {
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
            return Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::ComputationFailed,
                message: Some(format!("Operation {} already exists", self.id())),
            });
        }
        let api = self.clone();
        let state = self.state_api.clone();
        let tracker = self.tracker_api.clone();
        let session_file = if matches!(operation.kind, OperationKind::Extract { .. }) {
            Some(state.get_session_file().await?)
        } else {
            None
        };
        spawn(async move {
            api.started();
            let operation_str = &format!("{}", operation.kind);
            match operation.kind {
                OperationKind::Observe(options) => {
                    api.finish(
                        handlers::observe::start_observing(api.clone(), state, options, rx_sde)
                            .await,
                        operation_str,
                    )
                    .await;
                }
                OperationKind::Search { filters } => {
                    api.finish(
                        handlers::search::execute_search(&api, filters, state)
                            .await
                            .map(|v| v.map(stypes::ResultU64)),
                        operation_str,
                    )
                    .await;
                }
                OperationKind::SearchValues { filters } => {
                    api.finish(
                        handlers::search_values::execute_value_search(&api, filters, state).await,
                        operation_str,
                    )
                    .await;
                }
                OperationKind::Export {
                    out_path,
                    ranges,
                    columns,
                    spliter,
                    delimiter,
                } => {
                    api.finish(
                        Ok(state
                            .export_session(
                                out_path,
                                ranges,
                                columns,
                                spliter,
                                delimiter,
                                api.cancellation_token(),
                            )
                            .await
                            .map(stypes::ResultBool)
                            .ok()),
                        operation_str,
                    )
                    .await;
                }
                OperationKind::ExportRaw { out_path, ranges } => {
                    api.finish(
                        handlers::export_raw::execute_export(
                            &api.cancellation_token(),
                            state,
                            out_path,
                            ranges,
                        )
                        .await
                        .map(|v| v.map(stypes::ResultBool)),
                        operation_str,
                    )
                    .await;
                }
                OperationKind::Extract { filters } => {
                    let session_file = if let Some(session_file) = session_file {
                        session_file
                    } else {
                        warn!("Fail to call OperationKind::Extract: no session file");
                        return;
                    };
                    api.finish(
                        handlers::extract::handle(session_file, filters)
                            .map(|v| v.map(stypes::ResultExtractedMatchValues)),
                        operation_str,
                    )
                    .await;
                }
                OperationKind::Map { dataset_len, range } => {
                    match state.get_scaled_map(dataset_len, range).await {
                        Ok(map) => {
                            api.finish(
                                Ok(Some(stypes::ResultScaledDistribution(map))),
                                operation_str,
                            )
                            .await;
                        }
                        Err(err) => {
                            api.finish::<OperationResult<()>>(Err(err), operation_str)
                                .await;
                        }
                    }
                }
                OperationKind::Values { dataset_len, range } => {
                    match state.get_search_values(range, dataset_len).await {
                        Ok(map) => {
                            api.finish(
                                Ok(Some(stypes::ResultSearchValues(
                                    map.into_iter()
                                        .map(|(k, v)| {
                                            (k, v.into_iter().map(|v| v.into()).collect())
                                        })
                                        .collect(),
                                ))),
                                operation_str,
                            )
                            .await;
                        }
                        Err(err) => {
                            api.finish::<OperationResult<()>>(Err(err), operation_str)
                                .await;
                        }
                    }
                }
                OperationKind::Merge {
                    files: _,
                    out_path: _,
                    append: _,
                    source_id: _,
                } => {
                    unimplemented!("merging not yet supported");
                }
                OperationKind::Sleep(ms, ignore_cancellation) => {
                    api.finish(
                        handlers::sleep::handle(&api, ms, ignore_cancellation).await,
                        operation_str,
                    )
                    .await;
                }
                OperationKind::Cancel { target } => match tracker.cancel_operation(target).await {
                    Ok(canceled) => {
                        if canceled {
                            api.finish::<OperationResult<()>>(Ok(None), operation_str)
                                .await;
                        } else {
                            api.finish::<OperationResult<()>>(
                                Err(stypes::NativeError {
                                    severity: stypes::Severity::WARNING,
                                    kind: stypes::NativeErrorKind::Io,
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
                            Err(stypes::NativeError {
                                severity: stypes::Severity::WARNING,
                                kind: stypes::NativeErrorKind::Io,
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
                            api.finish(Ok(Some(nearest)), operation_str).await;
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

pub fn uuid_from_str(operation_id: &str) -> Result<Uuid, stypes::ComputationError> {
    match Uuid::parse_str(operation_id) {
        Ok(uuid) => Ok(uuid),
        Err(e) => Err(stypes::ComputationError::Process(format!(
            "Fail to parse operation uuid from {operation_id}. Error: {e}"
        ))),
    }
}

/// Listen to incoming operations requests in the session and execute them,
/// closing the state and trackers once operations are done.
pub async fn run(
    mut rx_operations: UnboundedReceiver<Operation>,
    state_api: SessionStateAPI,
    tracker_api: OperationTrackerAPI,
    tx_callback_events: UnboundedSender<stypes::CallbackEvent>,
) {
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
                operation_api.emit(stypes::CallbackEvent::OperationError {
                    uuid: operation_api.id(),
                    error: err,
                });
            }
        } else {
            debug!("session closing is requested");
            break;
        }
    }
    if let Err(err) = state_api.close_session().await {
        error!("Failed to close session: {err:?}");
    }
    if let Err(err) = tracker_api.shutdown() {
        error!("Failed to shutdown tracker: {err:?}");
    }
    if let Err(err) = state_api.shutdown() {
        error!("Fail to shutdown state; error: {err:?}");
    }
    debug!("operations task finished");
}
