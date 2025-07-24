use parsers::{Attachment, COLUMN_SENTINAL, LogRecordOutput, LogRecordsBuffer};

pub struct MockLogsBuffer {
    messages: Vec<String>,
    attachments: Vec<Attachment>,
    id: u16,
}

impl MockLogsBuffer {
    pub fn new(id: u16) -> Self {
        Self {
            messages: Vec::new(),
            attachments: Vec::new(),
            id,
        }
    }
}

impl LogRecordsBuffer for MockLogsBuffer {
    fn append(&mut self, record: LogRecordOutput<'_>) {
        match record {
            LogRecordOutput::Raw(inner) => {
                self.messages.push(
                    inner
                        .iter()
                        .map(|b| format!("{:02X}", b))
                        .collect::<String>(),
                );
            }
            LogRecordOutput::Message(msg) => {
                self.messages.push(msg.to_string());
            }
            LogRecordOutput::Columns(inner) => {
                self.messages.push(inner.join(&COLUMN_SENTINAL.to_string()));
            }
            LogRecordOutput::Multiple(inner) => {
                for rec in inner {
                    self.append(rec);
                }
            }
            LogRecordOutput::Attachment(inner) => {
                self.attachments.push(inner);
            }
        }
    }

    async fn flush(&mut self) -> Result<(), stypes::NativeError> {
        Ok(())
    }

    fn get_source_id(&self) -> u16 {
        self.id
    }
}
