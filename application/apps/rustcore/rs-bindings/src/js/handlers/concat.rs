use super::assign;
use crate::js::{
    events::{CallbackEvent, NativeError, NativeErrorKind},
    session::{SessionState, SupportedFileType},
};
use crossbeam_channel as cc;
use indexer_base::progress::{Progress, Severity};
use merging::concatenator::{concat_files_use_config_file, ConcatenatorInput};
use std::path::Path;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[allow(clippy::too_many_arguments)]
pub async fn handle(
    operation_id: Uuid,
    files: Vec<ConcatenatorInput>,
    out_path: &Path,
    append: bool,
    source_type: SupportedFileType,
    source_id: String,
    state: &mut SessionState,
    cancellation_token: CancellationToken,
) -> CallbackEvent {
    let (tx, _rx) = cc::unbounded();
    match concat_files_use_config_file(files, out_path, append, 500, tx, None) {
        Ok(()) => {
            match assign::handle(out_path, source_type, source_id, state, cancellation_token) {
                Ok(Some(line_count)) => CallbackEvent::StreamUpdated(line_count),
                Ok(None) => CallbackEvent::Progress {
                    uuid: operation_id,
                    progress: Progress::Stopped,
                },
                Err(error) => CallbackEvent::OperationError {
                    uuid: operation_id,
                    error,
                },
            }
        }
        Err(err) => CallbackEvent::OperationError {
            uuid: operation_id,
            error: NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::OperationSearch,
                message: Some(format!("Failed to concatenate files: {}", err)),
            },
        },
    }
}
