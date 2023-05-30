use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use sources::{
    factory::{ObserveFileType, ParserType},
    pcap::file::PcapngByteSource,
    raw::binary::BinaryByteSource,
};
use std::{fs::File, path::PathBuf};

#[allow(clippy::type_complexity)]
pub async fn concat_files(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    files: &[(String, ObserveFileType, PathBuf)],
    parser: &ParserType,
) -> OperationResult<()> {
    for file in files.iter() {
        let (uuid, _file_type, _filename) = file;
        state.add_source(uuid).await?;
    }
    for file in files.iter() {
        let (uuid, file_type, filename) = file;
        let source_id = state.get_source(uuid).await?.ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!(
                "Cannot find source id for file {} with alias {}",
                filename.to_string_lossy(),
                uuid,
            )),
        })?;
        let input_file = File::open(filename).map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!(
                "Fail open file {}: {}",
                filename.to_string_lossy(),
                e
            )),
        })?;
        match file_type {
            ObserveFileType::Binary => {
                super::run_source(
                    operation_api.clone(),
                    state.clone(),
                    BinaryByteSource::new(input_file),
                    source_id,
                    parser,
                    None,
                    None,
                )
                .await?
            }
            ObserveFileType::Pcap => {
                super::run_source(
                    operation_api.clone(),
                    state.clone(),
                    PcapngByteSource::new(input_file)?,
                    source_id,
                    parser,
                    None,
                    None,
                )
                .await?
            }
            ObserveFileType::Text => {
                super::run_source(
                    operation_api.clone(),
                    state.clone(),
                    BinaryByteSource::new(input_file),
                    source_id,
                    parser,
                    None,
                    None,
                )
                .await?
            }
        };
    }
    Ok(Some(()))
}
