use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use definitions::*;
use log::{trace, warn};
use processor::producer::{sde::*, MessageProducer, MessageStreamItem};
use std::time::Instant;
use stypes::NativeError;
use tokio::{select, sync::mpsc::Receiver};

/// Duration (in milliseconds) between flushes to the session file.
const SEND_DURATION: u128 = 500;

/// A writer responsible for appending data to a session file.
///
/// This writer is linked to a session file through the `SessionStateAPI`.
/// Instead of writing continuously, it accumulates updates and sends them
/// in periodic batches defined by `SEND_DURATION` (in milliseconds).
///
/// To support this behavior, it uses two internal buffers:
/// - `buffer` accumulates textual log entries.
/// - `attachments` stores associated `Attachment` objects, which are sent
///   only after flushing the text buffer to ensure synchronization between
///   log lines and attachments.
pub struct Writer {
    /// Communication channel to the session file.
    state: SessionStateAPI,

    /// Text buffer for log messages. Since session files are text-based,
    /// the buffered data is stored as a `String`.
    buffer: String,

    /// Buffer for received attachments. These are queued and sent only after
    /// the buffered log messages have been flushed, preserving the logical
    /// order between messages and attachments.
    attachments: Vec<Attachment>,

    /// Timestamp used to track the last flush to the session file.
    recent: Instant,

    /// Unique identifier for the data source. This is used on the client side
    /// to visually group or distinguish data streams.
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
                // TODO: Needs to be optimized. Also this use-case doesn't seem normal, should be some logs
                // because during observe we do not expect raw data
                self.buffer.push_str(
                    &inner
                        .iter()
                        .map(|b| format!("{:02X}", b))
                        .collect::<String>(),
                );
                self.buffer.push('\n');
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

enum Next {
    Parsed(usize, MessageStreamItem),
    Waiting,
    Sde(SdeMsg),
}

pub async fn run_producer<P: Parser, S: ByteSource, W: LogRecordWriter>(
    operation_api: OperationAPI,
    state: SessionStateAPI,
    mut producer: MessageProducer<'_, P, S, W>,
    mut rx_tail: Option<Receiver<Result<(), tail::Error>>>,
    mut rx_sde: Option<SdeReceiver>,
) -> OperationResult<()> {
    use log::debug;
    state.set_session_file(None).await?;
    operation_api.processing();
    let cancel = operation_api.cancellation_token();
    let cancel_on_tail = cancel.clone();
    let started = Instant::now();
    while let Some(next) = select! {
        next_from_stream = async {
            producer.read_next_segment().await
                .map(|(consumed, results)|Next::Parsed(consumed, results))
                .or_else(|| Some(Next::Waiting))
        } => next_from_stream,
        Some(sde_msg) = async {
            if let Some(rx_sde) = rx_sde.as_mut() {
                rx_sde.recv().await
            } else {
                None
            }
        } => Some(Next::Sde(sde_msg)),
        _ = cancel.cancelled() => None,
    } {
        match next {
            Next::Parsed(_consumed, results) => match results {
                MessageStreamItem::Parsed(_results) => {
                    //Just continue
                }
                MessageStreamItem::Done => {
                    state.flush_session_file().await?;
                    state.file_read().await?;
                    debug!(
                        "observe, message stream is done in {} ms",
                        started.elapsed().as_millis()
                    );
                }
                MessageStreamItem::Skipped => {
                    trace!("observe: skipped a message");
                }
            },
            Next::Waiting => {
                if !state.is_closing() {
                    state.flush_session_file().await?;
                }
                if let Some(mut rx_tail) = rx_tail.take() {
                    if select! {
                        next_from_stream = rx_tail.recv() => {
                            if let Some(result) = next_from_stream {
                                result.is_err()
                            } else {
                                true
                            }
                        },
                        _ = cancel_on_tail.cancelled() => true,
                    } {
                        break;
                    }
                } else {
                    break;
                }
            }
            Next::Sde((msg, tx_response)) => {
                let sde_res = producer.sde_income(msg).await.map_err(|e| e.to_string());
                if tx_response.send(sde_res).is_err() {
                    warn!("Fail to send back message from source");
                }
            }
        }
    }
    debug!("listen done");
    Ok(None)
}
