use super::assign;
use crate::js::session::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    SupportedFileType,
};
use crossbeam_channel as cc;
use indexer_base::progress::Severity;
use merging::concatenator::{concat_files_use_config_file, ConcatenatorInput};
use std::path::Path;

#[allow(clippy::too_many_arguments)]
pub async fn handle(
    operation_api: &OperationAPI,
    files: Vec<ConcatenatorInput>,
    out_path: &Path,
    append: bool,
    source_type: SupportedFileType,
    source_id: String,
    state: SessionStateAPI,
) -> OperationResult<()> {
    let (tx, _rx) = cc::unbounded();
    concat_files_use_config_file(
        files,
        out_path,
        append,
        500,
        tx,
        Some(operation_api.get_cancellation_token()),
    )
    .map_err(|err| NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::OperationSearch,
        message: Some(format!("Failed to concatenate files: {}", err)),
    })?;
    assign::handle(operation_api, out_path, source_type, source_id, state).await
}
