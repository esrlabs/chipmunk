use parsers::{Attachment, LogMessage};
use processor::producer::LogRecordsCollector;

use crate::state::SessionStateAPI;

/// A buffer for accumulating log data before writing to a session file.
///
/// This buffer is linked to a session file via the `SessionStateAPI`.
/// It accumulates updates and sends them when `flush()` is called.
///
/// It uses two internal stores to manage data:
/// - `buffer` accumulates textual log entries.
/// - `attachments` stores associated `Attachment` objects. These are sent
///   only after the text buffer is flushed to ensure synchronization.
pub struct LogsWriter {
    /// Communication channel to the session file.
    state: SessionStateAPI,

    /// Text buffer for log messages. Since session files are text-based,
    /// the buffered data is stored as a `String`.
    text_buffer: String,

    /// Buffer for received attachments. These are queued and sent only after
    /// the buffered log messages have been flushed, preserving the logical
    /// order between messages and attachments.
    attachments: Vec<Attachment>,

    /// Unique identifier for the data source. This is used on the client side
    /// to visually group or distinguish data streams.
    id: u16,
}

impl LogsWriter {
    pub fn new(state: SessionStateAPI, id: u16) -> Self {
        Self {
            state,
            id,
            text_buffer: String::new(),
            attachments: Vec::new(),
        }
    }

    /// Write the content of the internal buffers to the session.
    pub async fn write_to_session(&mut self) -> Result<(), stypes::NativeError> {
        if !self.text_buffer.is_empty() {
            // Creates an owned string from current buffer then clean the current. This operation
            // produces one mem_copy command for the needed bytes only while preserving
            // the capacity of the intermediate buffer.
            // Rust doesn't provide safe way to move bytes between strings without replacing
            // the whole string, forcing us to allocate the full capacity of the buffer on each
            // iteration (which could backfire in the internal buffer gets too long in one of the
            // iterations).
            let msgs = String::from(&self.text_buffer);
            self.text_buffer.clear();
            self.state.write_session_file(self.id, msgs).await?;
        }
        for attachment in self.attachments.drain(..) {
            // TODO: send all attachments with 1 call
            self.state.add_attachment(attachment)?;
        }
        Ok(())
    }
}

impl<T: LogMessage> LogRecordsCollector<T> for LogsWriter {
    fn append(&mut self, log_record: parsers::ParseYield<T>) {
        use std::fmt::Write;
        match log_record {
            parsers::ParseYield::Message(msg) => {
                // Writing to string never fails.
                _ = writeln!(&mut self.text_buffer, "{msg}");
            }
            parsers::ParseYield::Attachment(attachment) => {
                self.attachments.push(attachment);
            }
            parsers::ParseYield::MessageAndAttachment((msg, attachment)) => {
                _ = writeln!(&mut self.text_buffer, "{msg}");
                self.attachments.push(attachment);
            }
        }
    }
}
