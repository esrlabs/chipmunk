use crate::{
    grabber::{ComputationResult, GrabError, GrabMetadata, Grabber},
    text_source::TextFileSource,
};
use serde::Serialize;
use std::path::Path;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Serialize, Clone)]
pub enum SupportedFileType {
    Text,
}

pub fn get_supported_file_type(path: &Path) -> Result<SupportedFileType, GrabError> {
    let extension = path.extension().map(|ext| ext.to_string_lossy());
    match extension {
        Some(ext) => match ext.to_lowercase().as_ref() {
            "txt" | "text" => Ok(SupportedFileType::Text),
            _ => Ok(SupportedFileType::Text),
        },
        None => {
            // try to interpret as text
            if TextFileSource::contains_text(path)? {
                Ok(SupportedFileType::Text)
            } else {
                Err(GrabError::Unsupported(format!(
                    "Unsupported file type for {:?}",
                    path
                )))
            }
        }
    }
}

pub fn create_lazy_grabber(input_p: &Path, source_id: &str) -> Result<Grabber, GrabError> {
    match get_supported_file_type(input_p)? {
        SupportedFileType::Text => {
            let source = TextFileSource::new(input_p, source_id);
            let grabber = Grabber::lazy(source).map_err(|e| {
                let err_msg = format!("Could not create grabber: {}", e);
                warn!("{}", err_msg);
                GrabError::Config(err_msg)
            })?;
            Ok(grabber)
        }
    }
}

pub fn create_metadata_for_source(
    file_path: &Path,
    source_id: String,
    cancellation_token: CancellationToken,
) -> Result<ComputationResult<GrabMetadata>, GrabError> {
    match get_supported_file_type(file_path)? {
        SupportedFileType::Text => {
            let mut source = TextFileSource::new(file_path, &source_id);
            source.from_file(Some(cancellation_token))
        }
    }
}
