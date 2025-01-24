use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use sources::binary::{
    pcap::{legacy::PcapLegacyByteSource, ng::PcapngByteSource},
    raw::BinaryByteSource,
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
    file_format: &stypes::FileFormat,
    filename: &Path,
    parser: &'a stypes::ParserType,
) -> OperationResult<()> {
    let source_id = state.add_source(uuid).await?;
    let (tx_tail, mut rx_tail): (
        Sender<Result<(), tail::Error>>,
        Receiver<Result<(), tail::Error>>,
    ) = channel(1);
    match file_format {
        stypes::FileFormat::Binary | stypes::FileFormat::ParserPlugin => {
            //TODO AAZ: Remove prototyping code when not needed anymore.
            const PLUGIN_SOURCE_PATH_ENV: &str = "WASM_SOURCE_PATH";

            if let Ok(path) = std::env::var(PLUGIN_SOURCE_PATH_ENV) {
                println!("------------------------------------------------------");
                println!("-------------    WASM source used    -----------------");
                println!("------------------------------------------------------");

                use plugins_host::*;

                // Hard-coded configurations for file byte-source plugin temporally.
                const INPUT_PATH_ID: &str = "input-path";
                let file_source_configs = vec![stypes::PluginConfigItem::new(
                    INPUT_PATH_ID,
                    stypes::PluginConfigValue::Files(vec![filename.into()]),
                )];

                let setting =
                    stypes::PluginByteSourceSettings::prototyping(path.into(), file_source_configs);

                let plugin_source = PluginsByteSource::initialize(
                    &setting.plugin_path,
                    &setting.general_settings,
                    setting.plugin_configs.clone(),
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
        stypes::FileFormat::PcapLegacy => {
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
        stypes::FileFormat::PcapNG => {
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
        stypes::FileFormat::Text => {
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
                                update.map_err(|err| stypes::NativeError {
                                    severity: stypes::Severity::ERROR,
                                    kind: stypes::NativeErrorKind::Interrupted,
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
                    tracker.map_err(|e| stypes::NativeError {
                        severity: stypes::Severity::ERROR,
                        kind: stypes::NativeErrorKind::Interrupted,
                        message: Some(format!("Tailing error: {e}")),
                    })
                })
                .map(|_| None)
        }
    }
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
