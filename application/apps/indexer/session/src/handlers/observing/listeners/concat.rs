use crate::{
    events::{NativeError, NativeErrorKind},
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use sources::{factory::ParserType, pcap::file::PcapngByteSource, raw::binary::BinaryByteSource};
use std::{fs::File, path::PathBuf};

#[allow(clippy::type_complexity)]
pub async fn listen<'a>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    files: &[(String, PathBuf)],
    parser: &'a ParserType,
) -> OperationResult<()> {
    for file in files.iter() {
        let (uuid, filename) = file;
        let source_id = observing::sources::get_source_id(&state, uuid).await?;
        let input_file = File::open(filename).map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Io,
            message: Some(format!(
                "Fail open file {}: {}",
                filename.to_string_lossy(),
                e
            )),
        })?;
        match parser {
            ParserType::SomeIP(_) => {
                return Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::UnsupportedFileType,
                    message: Some(String::from("SomeIP parser not yet supported")),
                })
            }
            ParserType::Pcap(_) => {
                let source = PcapngByteSource::new(input_file)?;
                super::run(
                    operation_api.clone(),
                    state.clone(),
                    source,
                    source_id,
                    parser,
                    None,
                    None,
                )
                .await?;
            }
            ParserType::Dlt(_) => {
                let source = BinaryByteSource::new(input_file);
                super::run(
                    operation_api.clone(),
                    state.clone(),
                    source,
                    source_id,
                    parser,
                    None,
                    None,
                )
                .await?;
            }
            ParserType::Text => {
                let source = BinaryByteSource::new(input_file);
                super::run(
                    operation_api.clone(),
                    state.clone(),
                    source,
                    source_id,
                    parser,
                    None,
                    None,
                )
                .await?;
            }
        }
    }
    Ok(Some(()))
}
