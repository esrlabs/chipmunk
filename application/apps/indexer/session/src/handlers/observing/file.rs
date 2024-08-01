use crate::{
    events::{NativeError, NativeErrorKind},
    operations::{OperationAPI, OperationResult},
    progress::Severity,
    state::SessionStateAPI,
    tail,
};
use sources::{
    binary::{
        pcap::{legacy::PcapLegacyByteSource, ng::PcapngByteSource},
        raw::BinaryByteSource,
    },
    factory::{FileFormat, ParserType},
};
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
    file_format: &FileFormat,
    filename: &Path,
    parser: &'a ParserType,
) -> OperationResult<()> {
    let source_id = state.add_source(uuid).await?;
    let (tx_tail, mut rx_tail): (
        Sender<Result<(), tail::Error>>,
        Receiver<Result<(), tail::Error>>,
    ) = channel(1);
    match file_format {
        FileFormat::Binary => {
            //TODO AAZ: Remove prototyping code when not needed anymore.
            const PLUGIN_SOURCE_PATH_ENV: &str = "WASM_SOURCE_PATH";

            if let Ok(path) = std::env::var(PLUGIN_SOURCE_PATH_ENV) {
                println!("------------------------------------------------------");
                println!("-------------    WASM source used    -----------------");
                println!("------------------------------------------------------");

                use plugins_host::*;
                use sources::plugins;
                let setting = plugins::PluginByteSourceSettings::prototyping(
                    path.into(),
                    plugins::ByteSourceInput::File(filename.into()),
                );

                let plugin_source = PluginByteSource::create(
                    &setting.plugin_path,
                    setting.source_input,
                    &setting.general_settings,
                    setting.custom_config_path.as_ref(),
                )
                .await?;

                let source = BinaryByteSource::new(plugin_source);
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
            } else {
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
        FileFormat::PcapLegacy => {
            let source = PcapLegacyByteSource::new(input_file(filename)?)?;
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
        FileFormat::PcapNG => {
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
        FileFormat::Text => {
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
