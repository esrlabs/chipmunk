use super::assign;
use crate::js::{
    events::{CallbackEvent, NativeError, NativeErrorKind},
    session::{SessionState, SupportedFileType},
};
use crossbeam_channel as cc;
use indexer_base::progress::Severity;
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
) -> Result<CallbackEvent, NativeError> {
    let (tx, _rx) = cc::unbounded();
    match concat_files_use_config_file(files, out_path, append, 500, tx, None) {
        Ok(()) => assign::handle(
            operation_id,
            out_path,
            source_type,
            source_id,
            state,
            cancellation_token,
        ),
        Err(err) => Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::OperationSearch,
            message: Some(format!("Failed to concatenate files: {}", err)),
        }),
    }
}
