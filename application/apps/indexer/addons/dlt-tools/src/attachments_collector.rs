use parsers::{Attachment, LogMessage};
use processor::producer::LogRecordsCollector;

/// Logs Collector with interest of attachments only.
#[derive(Default)]
pub struct AttachmentsCollector {
    pub attachments: Vec<Attachment>,
}

impl<T: LogMessage> LogRecordsCollector<T> for AttachmentsCollector {
    fn append(&mut self, log_record: parsers::ParseYield<T>) {
        match log_record {
            parsers::ParseYield::Message(_) => {}
            parsers::ParseYield::Attachment(attachment) => self.attachments.push(attachment),
            parsers::ParseYield::MessageAndAttachment((_msg, attachment)) => {
                self.attachments.push(attachment)
            }
        }
    }
}
