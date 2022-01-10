use crate::{
    dlt_source::DltSource,
    grabber::{
        AsyncGrabTrait, ComputationResult, GrabError, GrabMetadata, Grabber, MetadataSource,
    },
    text_source::TextFileSource,
};
use serde::Serialize;
use std::path::Path;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Serialize, Clone)]
pub enum SupportedFileType {
    Text,
    Dlt,
}

pub fn get_supported_file_type(path: &Path) -> Result<SupportedFileType, GrabError> {
    let extension = path.extension().map(|ext| ext.to_string_lossy());
    match extension {
        Some(ext) => match ext.to_lowercase().as_ref() {
            "dlt" => Ok(SupportedFileType::Dlt),
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

pub fn create_lazy_grabber(
    input_p: &Path,
    source_id: &str,
) -> Result<Box<dyn AsyncGrabTrait>, GrabError> {
    match get_supported_file_type(input_p)? {
        SupportedFileType::Text => {
            type GrabberType = Grabber<TextFileSource>;
            let source = TextFileSource::new(input_p, source_id);
            let grabber = GrabberType::lazy(source).map_err(|e| {
                let err_msg = format!("Could not create grabber: {}", e);
                warn!("{}", err_msg);
                GrabError::Config(err_msg)
            })?;
            Ok(Box::new(grabber))
        }
        SupportedFileType::Dlt => {
            type GrabberType = Grabber<DltSource>;
            let source = DltSource::new(input_p, source_id, true);
            let grabber = GrabberType::lazy(source)
                .map_err(|e| GrabError::Config(format!("Could not create grabber: {}", e)))?;
            Ok(Box::new(grabber))
        }
    }
}

pub fn create_metadata_for_source(
    file_path: &Path,
    source_id: String,
    cancellation_token: CancellationToken,
) -> Result<ComputationResult<GrabMetadata>, GrabError> {
    match get_supported_file_type(file_path)? {
        SupportedFileType::Dlt => {
            let source = DltSource::new(file_path, &source_id, true);
            source.from_file(Some(cancellation_token))
        }
        SupportedFileType::Text => {
            let source = TextFileSource::new(file_path, &source_id);
            source.from_file(Some(cancellation_token))
        }
    }
}
