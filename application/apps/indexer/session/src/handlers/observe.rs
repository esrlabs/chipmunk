use crate::{
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use log::error;
use sources::{
    factory::{ObserveOptions, ObserveOrigin, ParserType},
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
        ObserveOrigin::File(uuid, file_origin, filename) => {
            let (is_text, session_file_origin) = (
                matches!(options.parser, ParserType::Text),
                state.get_session_file_origin().await?,
            );
            match session_file_origin {
                Some(origin) if origin.is_linked() => Err(stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Configuration,
                    message: Some(String::from(
                        "Cannot observe file, because session is linked to other text file",
                    )),
                }),
                Some(origin) if !origin.is_linked() && is_text => {
                    // Session file was created and some files/streams were opened already. We should check for text files
                    // to prevent attempt to link session with text file. Using concat instead
                    observing::concat::concat_files(
                        operation_api,
                        state,
                        &[(uuid.clone(), file_origin.clone(), filename.clone())],
                        &options.parser,
                    )
                    .await
                }
                _ => {
                    observing::file::observe_file(
                        operation_api,
                        state,
                        uuid,
                        file_origin,
                        filename,
                        &options.parser,
                    )
                    .await
                }
            }
        }
        ObserveOrigin::Concat(files) => {
            if files.is_empty() {
                Err(stypes::NativeError {
                    severity: stypes::Severity::ERROR,
                    kind: stypes::NativeErrorKind::Configuration,
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
