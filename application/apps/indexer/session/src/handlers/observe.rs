use std::{mem, sync::Arc};

use crate::{
    handlers::observing,
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
};
use components::Components;
use definitions::{Attachment, LogRecordOutput, LogRecordWriter};
use log::error;
use parsers::Parser;
use sources::{producer::MessageProducer, sde::SdeReceiver};
use std::time::Instant;
use stypes::NativeError;

use super::observing::run_producer;

const SEND_DURATION: u128 = 500;

struct Writer {
    state: SessionStateAPI,
    buffer: String,
    attachments: Vec<Attachment>,
    recent: Instant,
    id: u16,
}

impl Writer {
    pub fn new(state: SessionStateAPI, id: u16) -> Self {
        Self {
            state,
            buffer: String::new(),
            attachments: Vec::new(),
            recent: Instant::now(),
            id,
        }
    }
}

impl LogRecordWriter for Writer {
    fn write(&mut self, record: LogRecordOutput<'_>) -> Result<(), NativeError> {
        match record {
            LogRecordOutput::Raw(inner) => {
                // self.state
                //     .write_session_file(0, format!("{:02X}\n", inner))
                //     .await?;
            }
            LogRecordOutput::Cow(inner) => {
                self.buffer.push_str(&inner);
                self.buffer.push('\n');
            }
            LogRecordOutput::String(inner) => {
                self.buffer.push_str(&inner);
                self.buffer.push('\n');
            }
            LogRecordOutput::Str(inner) => {
                self.buffer.push_str(inner);
                self.buffer.push('\n');
            }
            LogRecordOutput::Columns(inner) => {
                self.buffer
                    .push_str(&inner.join(&definitions::COLUMN_SENTINAL.to_string()));
                self.buffer.push('\n');
            }
            LogRecordOutput::Multiple(inner) => {
                for record in inner.into_iter() {
                    self.write(record)?;
                }
            }
            LogRecordOutput::Attachment(inner) => {
                self.attachments.push(inner);
            }
        }
        if self.recent.elapsed().as_millis() > SEND_DURATION {
            if !self.buffer.is_empty() {
                self.state
                    .send_to_session_file(self.get_id(), std::mem::take(&mut self.buffer))?;
            }
            for attachment in std::mem::take(&mut self.attachments) {
                // TODO: send with 1 call
                self.state.add_attachment(attachment)?;
            }
            self.recent = Instant::now();
        }
        Ok(())
    }
    fn finalize(&mut self) -> Result<(), stypes::NativeError> {
        if !self.buffer.is_empty() {
            self.state
                .send_to_session_file(self.get_id(), std::mem::take(&mut self.buffer))?;
        }
        for attachment in std::mem::take(&mut self.attachments) {
            // TODO: send with 1 call
            self.state.add_attachment(attachment)?;
        }
        Ok(())
    }
    fn get_id(&self) -> u16 {
        self.id
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
    let producer = MessageProducer::new(parser, source, Writer::new(state.clone(), 0));
    let result = run_producer(operation_api, state, 0, producer, None, rx_sde).await?;
    Ok(result)
}
