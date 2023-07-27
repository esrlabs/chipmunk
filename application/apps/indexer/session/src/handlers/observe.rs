use crate::{
    events::{NativeError, NativeErrorKind},
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::{SessionFileStage, SessionStateAPI},
};
use indexer_base::progress::Severity;
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
            let (is_text, session_file_stage) = (
                matches!(options.parser, ParserType::Text),
                state.get_session_file_stage().await?,
            );
            match session_file_stage {
                SessionFileStage::Linked => Err(NativeError {
                    severity: Severity::ERROR,
                    kind: NativeErrorKind::Configuration,
                    message: Some(String::from(
                        "Cannot observe file, because session is linked to other text file",
                    )),
                }),
                SessionFileStage::NotLinked if is_text => {
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
                SessionFileStage::NotLinked | SessionFileStage::NotCreated => {
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
