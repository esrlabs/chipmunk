use crate::{
    events::{CallbackEvent, NativeError},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use processor::grabber::factory::create_metadata_for_source;

use indexer_base::progress::{ComputationResult, Progress};
use log::{debug, info, trace};

use processor::grabber::GrabMetadata;
use std::path::Path;

/// assign a file initially by creating the meta for it and sending it as metadata update
/// for the content grabber (current_grabber)
/// if the metadata was successfully created, we return the line count of it
/// if the operation was stopped, we return None
pub async fn handle(
    operation_api: &OperationAPI,
    file_path: &Path,
    source_id: String,
    state: SessionStateAPI,
) -> OperationResult<()> {
    match create_metadata_for_source(file_path, source_id, operation_api.get_cancellation_token()) {
        Ok(ComputationResult::Item(metadata)) => {
            trace!("received metadata {:?}", metadata);
            debug!("RUST: received metadata");
            let line_count: u64 = metadata.line_count as u64;
            update_state(state, Some(line_count), Some(Some(metadata))).await?;
            operation_api.emit(CallbackEvent::StreamUpdated(line_count));
            Ok(None)
        }
        Ok(ComputationResult::Stopped) => {
            info!("RUST: metadata calculation aborted");
            update_state(state, None, Some(None)).await?;
            operation_api.emit(CallbackEvent::Progress {
                uuid: operation_api.id(),
                progress: Progress::Stopped,
            });
            Ok(None)
        }
        Err(e) => Err(e.into()),
    }
}

async fn update_state(
    state: SessionStateAPI,
    stream_len: Option<u64>,
    metadata: Option<Option<GrabMetadata>>,
) -> Result<(), NativeError> {
    if let Some(stream_len) = stream_len {
        state.set_stream_len(stream_len).await?;
    }
    if let Some(metadata) = metadata {
        state.set_metadata(metadata).await?;
    }
    Ok(())
}
