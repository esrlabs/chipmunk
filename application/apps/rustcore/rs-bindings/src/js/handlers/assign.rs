use crate::js::{
    events::{CallbackEvent, NativeError},
    session::{SessionState, SupportedFileType},
};
use indexer_base::progress::{ComputationResult, Progress};
use log::{debug, info, trace};

use processor::{
    dlt_source::DltSource,
    grabber::{GrabError, GrabMetadata, MetadataSource},
    text_source::TextFileSource,
};
use std::path::Path;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

/// assign a file initially by creating the meta for it and sending it as metadata update
/// for the content grabber (current_grabber)
/// if the metadata was successfully created, we return the line count of it
/// if the operation was stopped, we return None
pub fn handle(
    operation_id: Uuid,
    file_path: &Path,
    source_type: SupportedFileType,
    source_id: String,
    state: &mut SessionState,
    _cancellation_token: CancellationToken,
) -> Result<CallbackEvent, NativeError> {
    match create_metadata_for_source(file_path, source_type, source_id) {
        Ok(ComputationResult::Item(metadata)) => {
            trace!("received metadata {:?}", metadata);
            debug!("RUST: received metadata");
            let line_count: u64 = metadata.line_count as u64;
            update_state(state, Some(line_count), Some(Some(metadata)));
            Ok(CallbackEvent::StreamUpdated(line_count))
        }
        Ok(ComputationResult::Stopped) => {
            info!("RUST: metadata calculation aborted");
            let _ = update_state(state, None, Some(None));
            Ok(CallbackEvent::Progress {
                uuid: operation_id,
                progress: Progress::Stopped,
            })
        }
        Err(e) => Err(e.into()),
    }
}

fn create_metadata_for_source(
    file_path: &Path,
    source_type: SupportedFileType,
    source_id: String,
) -> Result<ComputationResult<GrabMetadata>, GrabError> {
    match source_type {
        SupportedFileType::Dlt => {
            let source = DltSource::new(file_path, &source_id);
            source.from_file(None)
        }
        SupportedFileType::Text => {
            let source = TextFileSource::new(file_path, &source_id);
            source.from_file(None)
        }
    }
}

fn update_state(
    state: &mut SessionState,
    stream_len: Option<u64>,
    metadata: Option<Option<GrabMetadata>>,
) {
    if let Some(stream_len) = stream_len {
        state.search_map.set_stream_len(stream_len);
    }
    if let Some(metadata) = metadata {
        state.metadata = metadata;
    }
}
