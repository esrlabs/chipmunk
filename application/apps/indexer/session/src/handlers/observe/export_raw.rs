use crate::operations::{OperationAPI, OperationResult};
use log::debug;
use parsers::api::*;
use processor::producer::MessageProducer;
use sources::api::*;

use std::{
    fs::File,
    io::{self, BufWriter, Write},
    path::Path,
};
use tokio::select;

pub struct ExportLogsBuffer {
    file_buffer: BufWriter<File>,
    bytes_buffer: Vec<u8>,
    index: usize,
    ranges: Vec<std::ops::RangeInclusive<u64>>,
}

impl ExportLogsBuffer {
    pub fn new<P: AsRef<Path>>(
        filename: P,
        ranges: Vec<std::ops::RangeInclusive<u64>>,
    ) -> io::Result<Self> {
        let filename = filename.as_ref();
        let out_file = if filename.exists() {
            std::fs::OpenOptions::new().append(true).open(filename)?
        } else {
            std::fs::File::create(filename)?
        };
        Ok(Self {
            file_buffer: BufWriter::new(out_file),
            bytes_buffer: Vec::new(),
            index: 0,
            ranges,
        })
    }
}

impl LogRecordsBuffer for ExportLogsBuffer {
    fn append(&mut self, record: LogRecordOutput<'_>) {
        if !self.ranges.is_empty() {
            // TODO: we can optimize index search
            if !self
                .ranges
                .iter()
                .any(|range| range.contains(&(self.index as u64)))
            {
                // Skip record because it's not in a range
                self.index += 1;
            }
        }
        self.index += 1;
        match record {
            LogRecordOutput::Raw(inner) => {
                self.bytes_buffer.extend_from_slice(inner);
            }
            LogRecordOutput::Message(inner) => {
                self.bytes_buffer.extend_from_slice(inner.as_bytes());
                self.bytes_buffer.push(b'\n');
            }
            LogRecordOutput::Columns(inner) => {
                let mut items = inner.into_iter();
                if let Some(first_item) = items.next() {
                    self.bytes_buffer.extend_from_slice(first_item.as_bytes());
                    for item in items {
                        self.bytes_buffer.push(parsers::api::COLUMN_SENTINAL as u8);
                        self.bytes_buffer.extend_from_slice(item.as_bytes());
                    }
                }
                self.bytes_buffer.push(b'\n');
            }
            LogRecordOutput::Multiple(inner) => {
                for rec in inner {
                    self.append(rec);
                }
            }
            LogRecordOutput::Attachment(att) => {
                log::error!(
                    "Log attachments provided in raw export. Attachment name: {}",
                    att.name
                );
            }
        }
    }
    async fn flush(&mut self) -> Result<(), stypes::NativeError> {
        if !self.bytes_buffer.is_empty() {
            self.file_buffer.write_all(&self.bytes_buffer)?;
            self.bytes_buffer.clear()
        }
        self.file_buffer.flush()?;

        Ok(())
    }
    fn get_source_id(&self) -> u16 {
        0
    }
}

pub async fn run_producer<P: Parser, S: ByteSource, B: LogRecordsBuffer>(
    operation_api: OperationAPI,
    mut producer: MessageProducer<'_, P, S, B>,
) -> OperationResult<bool> {
    operation_api.processing();
    let cancel = operation_api.cancellation_token();
    while select! {
        next_from_stream = producer.read_next_segment() => next_from_stream,
        _ = async {
            cancel.cancelled().await;
            debug!("exporting operation has been cancelled");
        } => None,
    }
    .is_some()
    {
        // Do nothing. Writing happens on MessageProducer level
    }
    debug!("exporting is done");
    Ok(Some(!cancel.is_cancelled()))
}
