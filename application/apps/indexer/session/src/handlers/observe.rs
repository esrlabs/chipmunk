use crate::{
    events::{NativeError, NativeErrorKind},
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use indexer_base::progress::Severity;
use sources::{
    factory::{ObserveOptions, Sources},
    producer::SdeReceiver,
};

#[allow(clippy::type_complexity)]
pub async fn handle(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    options: ObserveOptions,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    match &options.origin {
        Sources::File(uuid, filename) => {
            observing::listeners::file::listen(
                operation_api,
                state,
                uuid,
                filename,
                &options.parser,
            )
            .await
        }
        Sources::Concat(files) => {
            if files.len() == 0 {
                Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::NotYetImplemented,
                    message: Some(String::from("No files are defined for Concat operation")),
                })
            } else {
                observing::listeners::concat::listen(operation_api, state, files, &options.parser)
                    .await
            }
        }
        Sources::Stream(uuid, transport) => {
            observing::listeners::stream::listen(
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
