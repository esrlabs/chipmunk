use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use sources::{
    ByteSource,
    binary::{
        pcap::{legacy::PcapLegacyByteSource, ng::PcapngByteSource},
        raw::BinaryByteSource,
    },
};
use std::{fs::File, path::Path};
use tokio::{join, sync::mpsc::channel};

pub async fn observe_file(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    uuid: &str,
    file_format: &stypes::FileFormat,
    filename: &Path,
    parser: &stypes::ParserType,
) -> OperationResult<()> {
    let source_id = state.add_source(uuid).await?;
    let file = input_file(filename)?;
    match file_format {
        // Text files hold no framing of their own, so they are read as raw bytes like binary
        // ones and turned into text by the parser, which keeps the session file valid UTF-8.
        stypes::FileFormat::Binary | stypes::FileFormat::Text => {
            produce_from_file(
                operation_api,
                state,
                BinaryByteSource::new(file),
                source_id,
                parser,
                filename,
            )
            .await
        }
        stypes::FileFormat::PcapLegacy => {
            produce_from_file(
                operation_api,
                state,
                PcapLegacyByteSource::new(file)?,
                source_id,
                parser,
                filename,
            )
            .await
        }
        stypes::FileFormat::PcapNG => {
            produce_from_file(
                operation_api,
                state,
                PcapngByteSource::new(file)?,
                source_id,
                parser,
                filename,
            )
            .await
        }
    }
}

/// Runs the producer on `source` while the file is watched for changes, so the session keeps
/// consuming content appended after the initial pass.
async fn produce_from_file<S: ByteSource>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    source: S,
    source_id: u16,
    parser: &stypes::ParserType,
    filename: &Path,
) -> OperationResult<()> {
    let (tx_tail, rx_tail) = channel(1);
    let (_, listening) = join!(
        tail::track(filename, tx_tail, operation_api.cancellation_token()),
        super::run_source(
            operation_api,
            state,
            source,
            source_id,
            parser,
            None,
            Some(rx_tail),
        )
    );
    listening
}

fn input_file(filename: &Path) -> Result<File, stypes::NativeError> {
    File::open(filename).map_err(|e| stypes::NativeError {
        severity: stypes::Severity::ERROR,
        kind: stypes::NativeErrorKind::Io,
        message: Some(format!(
            "Fail open file {}: {}",
            filename.to_string_lossy(),
            e
        )),
    })
}
