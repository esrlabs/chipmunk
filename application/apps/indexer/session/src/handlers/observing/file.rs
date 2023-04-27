use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use indexer_base::progress::Severity;
use sources::{factory::ParserType, pcap::file::PcapngByteSource, raw::binary::BinaryByteSource};
use std::{fs::File, path::Path};
use tokio::{
    join, select,
    sync::mpsc::{channel, Receiver, Sender},
};

#[allow(clippy::type_complexity)]
pub async fn observe_file<'a>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    uuid: &str,
    filename: &Path,
    parser: &'a ParserType,
) -> OperationResult<()> {
    let source_id = state.add_source(uuid).await?;
    let (tx_tail, mut rx_tail): (
        Sender<Result<(), tail::Error>>,
        Receiver<Result<(), tail::Error>>,
    ) = channel(1);
    match parser {
        ParserType::Text => {
            state.set_session_file(Some(filename.to_path_buf())).await?;
            // Grab main file content
            state.update_session(source_id).await?;
            operation_api.processing();
            // Confirm: main file content has been read
            state.file_read().await?;
            // Switching to tail
            let cancel = operation_api.cancellation_token();
            let (result, tracker) = join!(
                async {
                    let result = select! {
                        res = async move {
                            while let Some(update) = rx_tail.recv().await {
                                update.map_err(|err| NativeError {
                                    severity: Severity::ERROR,
                                    kind: NativeErrorKind::Interrupted,
                                    message: Some(err.to_string()),
                                })?;
                                state.update_session(source_id).await?;
                            }
                            Ok(())
                        } => res,
                        _ = cancel.cancelled() => Ok(())
                    };
                    result
                },
                tail::track(filename, tx_tail, operation_api.cancellation_token()),
            );
            result
                .and_then(|_| {
                    tracker.map_err(|e| NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Interrupted,
                        message: Some(format!("Tailing error: {e}")),
                    })
                })
                .map(|_| None)
        }
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
        ParserType::Pcap(_) => {
            let source = PcapngByteSource::new(input_file(filename)?)?;
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
