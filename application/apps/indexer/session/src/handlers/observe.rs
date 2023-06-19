use crate::{
    events::{NativeError, NativeErrorKind},
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use log::error;
use sources::{
    factory::{ObserveFileType, ObserveOptions, ObserveOrigin, ParserType},
    producer::SdeReceiver,
};

pub async fn start_observing(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    mut options: ObserveOptions,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    if let ParserType::Dlt(ref mut settings) = options.parser {
        settings.load_fibex_metadata();
    };
    if let Err(err) = state.add_executed_observe(options.clone()).await {
        error!("Fail to store observe options: {:?}", err);
    }
    match &options.origin {
        ObserveOrigin::File(uuid, file_origin, filename) => match file_origin {
            ObserveFileType::Text => {
                observing::text_file::observe_text_file(
                    operation_api,
                    state,
                    uuid,
                    filename,
                    &options.parser,
                )
                .await
            }
            ObserveFileType::Binary => {
                observing::binary_file::observe_binary_file(
                    operation_api,
                    state,
                    uuid,
                    filename,
                    &options.parser,
                )
                .await
            }
            ObserveFileType::Pcap => {
                observing::pcap_file::observe_pcap_file(
                    operation_api,
                    state,
                    uuid,
                    filename,
                    &options.parser,
                )
                .await
            }
        },
        ObserveOrigin::Concat(files) => {
            if files.is_empty() {
                Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Configuration,
                    message: Some(String::from("No files are defined for Concat operation")),
                })
            } else {
                observing::concat::concat_files(operation_api, state, files, &options.parser).await
            }
        }
        ObserveOrigin::Stream(uuid, transport) => {
            observing::stream::observe_stream(
                operation_api,
                state,
                uuid,
                transport,
                &options.parser,
                rx_sde,
            )
            .await
        }
    }
}
