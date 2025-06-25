use crate::{
    operations::{OperationAPI, OperationResult},
    state::SessionStateAPI,
    tail,
};
use definitions::*;
use log::{trace, warn};
use processor::producer::{MessageProducer, MessageStreamItem, sde::*};
use std::time::Instant;
use stypes::NativeError;
use tokio::{select, sync::mpsc::Receiver};

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
                let mut items = inner.into_iter();
                if let Some(first_item) = items.next() {
                    self.buffer.push_str(&first_item);
                    for item in items {
                        self.buffer.push(definitions::COLUMN_SENTINAL);
                        self.buffer.push_str(&item);
                    }
                }
                self.buffer.push('\n');
            }
            LogRecordOutput::Multiple(inner) => {
                for rec in inner {
                    self.write(rec)?;
                }
            }
            LogRecordOutput::Attachment(inner) => {
                self.attachments.push(inner);
            }
        }
        Ok(())
    }
    async fn finalize(&mut self) -> Result<(), stypes::NativeError> {
        if !self.buffer.is_empty() {
            let mut buf = String::with_capacity(self.buffer.len());
            buf.push_str(&self.buffer);
            self.state.write_session_file(self.get_id(), buf).await?;
            self.buffer.clear();
        }
        for attachment in self.attachments.drain(..) {
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

/// **********************************************************************************************
/// For Ammar:
///
/// Currently, the use of select! requires careful handling of cancel-safety in all methods involved.
/// Instead of solving the rather complex problem of full cancel-safety, I suggest localizing the issue:
///
/// * Remove all non-essential functionality from the select! block and use it only to listen for
///   messages.
/// * File reading can be performed in a loop that regularly checks the state of the SDE queue.
/// * Once the end of the file is reached, we can begin listening with select! for changes in the data
///   source, updates from SDE, and termination signals.
/// **********************************************************************************************

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
                MessageStreamItem::Parsed(results) => {
                    //Just continue
                }
                MessageStreamItem::Done => {
                    state.flush_session_file().await?;
                    state.file_read().await?;
                    warn!(
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
