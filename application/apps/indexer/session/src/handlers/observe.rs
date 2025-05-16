use std::sync::Arc;

use crate::{
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use components::Components;
use definitions::{LogRecordOutput, LogRecordWriter};
use log::error;
use parsers::Parser;
use sources::{producer::MessageProducer, sde::SdeReceiver};
use stypes::NativeError;

use super::observing::run_producer;

struct Writer {
    state: SessionStateAPI,
}

impl Writer {
    pub fn new(state: SessionStateAPI) -> Self {
        Self { state }
    }
}

impl LogRecordWriter for Writer {
    async fn write(&mut self, record: LogRecordOutput<'_>) -> Result<(), NativeError> {
        match record {
            LogRecordOutput::Raw(inner) => {
                // self.state
                //     .write_session_file(0, format!("{:02X}\n", inner))
                //     .await?;
            }
            LogRecordOutput::Cow(inner) => {
                self.state
                    .write_session_file(0, format!("{inner}\n"))
                    .await?;
            }
            LogRecordOutput::String(inner) => {
                self.state
                    .write_session_file(0, format!("{inner}\n"))
                    .await?;
            }
            LogRecordOutput::Str(inner) => {
                self.state
                    .write_session_file(0, format!("{inner}\n"))
                    .await?;
            }
            LogRecordOutput::Columns(inner) => {
                self.state
                    .write_session_file(
                        0,
                        format!(
                            "{}\n",
                            inner.join(&definitions::COLUMN_SENTINAL.to_string())
                        ),
                    )
                    .await?;
            }
            LogRecordOutput::Multiple(inner) => {}
            LogRecordOutput::Attachment(inner) => {
                self.state.add_attachment(inner)?;
            }
        }
        Ok(())
    }
}
pub async fn start_observing(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    options: stypes::SessionSetup,
    components: Arc<Components<sources::Source, parsers::Parser>>,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    let (source, parser) = components.setup(&options)?;
    // let source_id = state.add_source(uuid).await?;
    println!(">>>>>>>>>>>>>>> 0000");
    let producer = MessageProducer::new(parser, source, Writer::new(state.clone()));
    println!(">>>>>>>>>>>>>>> 0001");
    let result = run_producer(operation_api, state, 0, producer, None, rx_sde).await?;
    println!(">>>>>>>>>>>>>>> 0002");
    Ok(result)
    // if let stypes::ParserType::Dlt(ref mut settings) = options.parser {
    //     settings.load_fibex_metadata();
    // };
    // if let Err(err) = state.add_executed_observe(options.clone()).await {
    //     error!("Fail to store observe options: {:?}", err);
    // }
    // match &options.origin {
    //     stypes::ObserveOrigin::File(uuid, file_origin, filename) => {
    //         let (is_text, session_file_origin) = (
    //             matches!(options.parser, stypes::ParserType::Text(())),
    //             state.get_session_file_origin().await?,
    //         );
    //         match session_file_origin {
    //             Some(origin) if origin.is_linked() => Err(stypes::NativeError {
    //                 severity: stypes::Severity::ERROR,
    //                 kind: stypes::NativeErrorKind::Configuration,
    //                 message: Some(String::from(
    //                     "Cannot observe file, because session is linked to other text file",
    //                 )),
    //             }),
    //             Some(origin) if !origin.is_linked() && is_text => {
    //                 // Session file was created and some files/streams were opened already. We should check for text files
    //                 // to prevent attempt to link session with text file. Using concat instead
    //                 observing::concat::concat_files(
    //                     operation_api,
    //                     state,
    //                     &[(uuid.clone(), file_origin.clone(), filename.clone())],
    //                     &options.parser,
    //                 )
    //                 .await
    //             }
    //             _ => {
    //                 observing::file::observe_file(
    //                     operation_api,
    //                     state,
    //                     uuid,
    //                     file_origin,
    //                     filename,
    //                     &options.parser,
    //                 )
    //                 .await
    //             }
    //         }
    //     }
    //     stypes::ObserveOrigin::Concat(files) => {
    //         if files.is_empty() {
    //             Err(stypes::NativeError {
    //                 severity: stypes::Severity::ERROR,
    //                 kind: stypes::NativeErrorKind::Configuration,
    //                 message: Some(String::from("No files are defined for Concat operation")),
    //             })
    //         } else {
    //             observing::concat::concat_files(operation_api, state, files, &options.parser).await
    //         }
    //     }
    //     stypes::ObserveOrigin::Stream(uuid, transport) => {
    //         observing::stream::observe_stream(
    //             operation_api,
    //             state,
    //             uuid,
    //             transport,
    //             &options.parser,
    //             rx_sde,
    //         )
    //         .await
    //     }
    // }
}
