use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use indexer_base::progress::Severity;
use sources::{factory::ParserType, raw::binary::BinaryByteSource};
use std::{fs::File, path::Path};
use tokio::{
    join,
    sync::mpsc::{channel, Receiver, Sender},
};

#[allow(clippy::type_complexity)]
pub async fn observe_binary_file<'a>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    uuid: &str,
    filename: &Path,
    parser: &'a ParserType,
) -> OperationResult<()> {
    let source_id = state.add_source(uuid).await?;
    let (tx_tail, rx_tail): (
        Sender<Result<(), tail::Error>>,
        Receiver<Result<(), tail::Error>>,
    ) = channel(1);
    match parser {
        ParserType::Text => Err(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::UnsupportedFileType,
            message: Some(String::from(
                "Text parser cannot be used with binary source",
            )),
        }),
        ParserType::Dlt(_) => {
            let source = BinaryByteSource::new(input_file(filename)?);
            let (_, listening) = join!(
                tail::track(filename, tx_tail, operation_api.cancellation_token()),
                super::run_source(
                    operation_api,
                    state,
                    source,
                    source_id,
                    parser,
                    None,
                    Some(rx_tail)
                )
            );
            listening
        }
        ParserType::SomeIP(_) => {
            let source = BinaryByteSource::new(input_file(filename)?);
            let (_, listening) = join!(
                tail::track(filename, tx_tail, operation_api.cancellation_token()),
                super::run_source(
                    operation_api,
                    state,
                    source,
                    source_id,
                    parser,
                    None,
                    Some(rx_tail)
                )
            );
            listening
        }
    }
}

fn input_file(filename: &Path) -> Result<File, NativeError> {
    File::open(filename).map_err(|e| NativeError {
        severity: Severity::ERROR,
        kind: NativeErrorKind::Io,
        message: Some(format!(
            "Fail open file {}: {}",
            filename.to_string_lossy(),
            e
        )),
    })
}
