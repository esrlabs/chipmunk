use parsers::{LogMessage, ParseYield};

/// Collector for log records which will be passed to the `MessageProducer`
/// so it can append log messages once they are parsed.
pub trait LogRecordsCollector<T: LogMessage> {
    /// Append the provided `log_record`.
    fn append(&mut self, log_record: ParseYield<T>);
}

/// General purpose [`LogRecordsCollector`] which just collect the provided logs
/// messages in internal buffer and gives access to this buffer without any
/// extra functionality.
#[derive(Debug)]
pub struct GeneralLogCollector<T> {
    internal_buffer: Vec<ParseYield<T>>,
}

impl<T> Default for GeneralLogCollector<T> {
    fn default() -> Self {
        Self {
            internal_buffer: Vec::new(),
        }
    }
}

impl<T> GeneralLogCollector<T> {
    /// Gives mutable access to the internal buffer where the records records
    /// has been collected.
    pub fn get_records(&mut self) -> &mut Vec<ParseYield<T>> {
        &mut self.internal_buffer
    }
}

impl<T: LogMessage> LogRecordsCollector<T> for GeneralLogCollector<T> {
    fn append(&mut self, log_record: ParseYield<T>) {
        self.internal_buffer.push(log_record);
    }
}
