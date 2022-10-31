use crate::{
    events::{NativeError, NativeErrorKind},
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::{SessionStateAPI},
    tail,
};
use indexer_base::progress::Severity;
use sources::factory::ParserType;
use std::path::PathBuf;
use tokio::{
    join, select,
    sync::mpsc::{channel, Receiver, Sender},
};

#[allow(clippy::type_complexity)]
pub async fn listen<'a>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    uuid: &str,
    filename: &PathBuf,
    parser: &'a ParserType,
) -> OperationResult<()> {
    let source_id = observing::sources::get_source_id(&state, uuid).await?;
    if let ParserType::Text = parser {
        state.set_session_file(Some(filename.clone())).await?;
        let (tx_tail, mut rx_tail): (
            Sender<Result<(), tail::Error>>,
            Receiver<Result<(), tail::Error>>,
        ) = channel(1);
        // Grab main file content
        state.update_session(source_id).await?;
        // Confirm: main file content has been read
        state.file_read().await?;
        // Switching to tail
        let cancel = operation_api.cancellation_token();
        operation_api.started();
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
                    message: Some(format!("Tailing error: {}", e)),
                })
            })
            .map(|_| None)
    } else {
        let (tx_tail, rx_tail): (
            Sender<Result<(), tail::Error>>,
            Receiver<Result<(), tail::Error>>,
        ) = channel(1);
        let (_, listening) = join!(
            tail::track(filename, tx_tail, operation_api.cancellation_token()),
            super::run(
                operation_api,
                state,
                observing::sources::file(parser, filename)?,
                source_id,
                parser,
                None,
                Some(rx_tail)
            )
        );
        listening
    }
}
