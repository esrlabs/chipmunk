use crate::{
    events::{NativeError, NativeErrorKind},
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use log::error;
use sources::{
    factory::{ObserveOptions, ObserveOrigin},
    producer::SdeReceiver,
};

pub async fn start_observing(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    options: ObserveOptions,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    if let Err(err) = state.add_executed_observe(options.clone()).await {
        error!("Fail to store observe options: {:?}", err);
    }
    match &options.origin {
        ObserveOrigin::File(uuid, filename) => {
            observing::file::observe_file(operation_api, state, uuid, filename, &options.parser)
                .await
        }
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
