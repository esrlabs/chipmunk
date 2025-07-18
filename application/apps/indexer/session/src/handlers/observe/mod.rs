mod export_raw;
mod session;

use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use components::Components;
use processor::producer::{MessageProducer, sde::*};
use std::sync::Arc;
use stypes::{SessionAction, SessionSetup};

pub async fn observing(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    options: SessionSetup,
    components: Arc<Components<sources::Sources, parsers::Parsers>>,
    rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    match &options.origin {
        SessionAction::File(..) => {
            let (desciptor, source, parser) = components.setup(&options)?;
            let mut logs_buffer = session::LogsBuffer::new(
                state.clone(),
                state.add_source(operation_api.id(), desciptor).await?,
            );
            let producer = MessageProducer::new(parser, source, &mut logs_buffer);
            Ok(session::run_producer(operation_api, state, producer, None, None).await?)
        }
        SessionAction::Source => {
            let (desciptor, source, parser) = components.setup(&options)?;
            let mut logs_buffer = session::LogsBuffer::new(
                state.clone(),
                state.add_source(operation_api.id(), desciptor).await?,
            );
            let producer = MessageProducer::new(parser, source, &mut logs_buffer);
            Ok(session::run_producer(operation_api, state, producer, None, rx_sde).await?)
        }
        SessionAction::Files(files) => {
            // Replacement of concat feature
            for file in files {
                let (desciptor, source, parser) =
                    components.setup(&options.inherit(SessionAction::File(file.to_owned())))?;
                let mut logs_buffer = session::LogsBuffer::new(
                    state.clone(),
                    state.add_source(operation_api.id(), desciptor).await?,
                );
                let producer = MessageProducer::new(parser, source, &mut logs_buffer);
                session::run_producer(operation_api.clone(), state.clone(), producer, None, None)
                    .await?;
            }
            Ok(Some(()))
        }
        SessionAction::ExportRaw(files, ranges, output) => {
            // We are creating one single buffer for all files to keep tracking ranges and current index
            let mut logs_buffer = export_raw::ExportLogsBuffer::new(output, ranges.clone())?;
            for file in files {
                if operation_api.cancellation_token().is_cancelled() {
                    return Ok(Some(()));
                }
                let (_, source, parser) =
                    components.setup(&options.inherit(SessionAction::File(file.to_owned())))?;
                let producer = MessageProducer::new(parser, source, &mut logs_buffer);
                export_raw::run_producer(operation_api.clone(), producer).await?;
            }
            Ok(Some(()))
        }
    }
}
