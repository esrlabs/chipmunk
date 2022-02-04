use crate::{
    events::{CallbackEvent, NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use crossbeam_channel as cc;
use indexer_base::progress::{IndexingProgress, Progress, Severity, Ticks};
use merging::merger::{merge_files_use_config, FileMergeOptions};
use std::path::Path;

#[allow(clippy::too_many_arguments)]
pub async fn handle(
    operation_api: &OperationAPI,
    files: Vec<FileMergeOptions>,
    out_path: &Path,
    append: bool,
    _source_id: String,
    _state: SessionStateAPI,
) -> OperationResult<()> {
    let (tx_progress, rx_progress) = cc::unbounded();
    merge_files_use_config(
        files,
        out_path,
        append,
        500,
        tx_progress,
        Some(operation_api.get_cancellation_token()),
    )
    .map_err(|err| NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::OperationSearch,
        message: Some(format!("Failed to merge files: {}", err)),
    })?;
    while let Ok(msg) = rx_progress.recv() {
        operation_api.emit(match msg {
            Ok(msg) => match msg {
                IndexingProgress::Stopped | IndexingProgress::Finished => CallbackEvent::Progress {
                    uuid: operation_api.id(),
                    progress: Progress::Stopped,
                },
                IndexingProgress::Progress { ticks } => {
                    let (count, total) = ticks;
                    CallbackEvent::Progress {
                        uuid: operation_api.id(),
                        progress: Progress::Ticks(Ticks { count, total }),
                    }
                }
                IndexingProgress::GotItem { item } => {
                    let (_, rows): (usize, usize) = item.r;
                    CallbackEvent::StreamUpdated(rows as u64)
                }
            },
            Err(notification) => CallbackEvent::Progress {
                uuid: operation_api.id(),
                progress: Progress::Notification(notification),
            },
        });
    }
    Ok(None)
    // observe::handle(operation_api, out_path, source_id, state).await
}
