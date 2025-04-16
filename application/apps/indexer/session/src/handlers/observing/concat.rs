use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use sources::binary::{
    pcap::{legacy::PcapLegacyByteSource, ng::PcapngByteSource},
    raw::BinaryByteSource,
};
use std::{fs::File, path::PathBuf};

#[allow(clippy::type_complexity)]
pub async fn concat_files(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    files: &[(String, stypes::FileFormat, PathBuf)],
    parser: stypes::ParserType,
) -> OperationResult<()> {
    for file in files.iter() {
        let (uuid, _file_type, _filename) = file;
        state.add_source(uuid).await?;
    }
    for file in files.iter() {
        let (uuid, file_type, filename) = file;
        let source_id = state.get_source(uuid).await?.ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Io,
            message: Some(format!(
                "Cannot find source id for file {} with alias {}",
                filename.to_string_lossy(),
                uuid,
            )),
        })?;
        let input_file = File::open(filename).map_err(|e| stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Io,
            message: Some(format!(
                "Fail open file {}: {}",
                filename.to_string_lossy(),
                e
            )),
        })?;
        //TODO AAZ: Check if we can avoid cloning the parser here.
        match file_type {
            stypes::FileFormat::Binary => {
                super::run_source(
                    operation_api.clone(),
                    state.clone(),
                    BinaryByteSource::new(input_file),
                    source_id,
                    parser.clone(),
                    None,
                    None,
                )
                .await?
            }
            stypes::FileFormat::PcapLegacy => {
                super::run_source(
                    operation_api.clone(),
                    state.clone(),
                    PcapLegacyByteSource::new(input_file)?,
                    source_id,
                    parser.clone(),
                    None,
                    None,
                )
                .await?
            }
            stypes::FileFormat::PcapNG => {
                super::run_source(
                    operation_api.clone(),
                    state.clone(),
                    PcapngByteSource::new(input_file)?,
                    source_id,
                    parser.clone(),
                    None,
                    None,
                )
                .await?
            }
            stypes::FileFormat::Text => {
                super::run_source(
                    operation_api.clone(),
                    state.clone(),
                    BinaryByteSource::new(input_file),
                    source_id,
                    parser.clone(),
                    None,
                    None,
                )
                .await?
            }
        };
    }
    Ok(Some(()))
}
