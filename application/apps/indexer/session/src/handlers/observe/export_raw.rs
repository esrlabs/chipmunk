use crate::operations::{OperationAPI, OperationResult};
use definitions::{ByteSource, LogRecordOutput, LogRecordWriter, Parser};
use log::debug;
use processor::producer::MessageProducer;

use std::{
    fs::File,
    io::{self, BufWriter, Write},
    path::Path,
};
use stypes::NativeError;
use tokio::select;

pub struct ExportWriter {
    buffer: BufWriter<File>,
    index: usize,
    ranges: Vec<std::ops::RangeInclusive<u64>>,
}

impl ExportWriter {
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
            buffer: BufWriter::new(out_file),
            index: 0,
            ranges,
        })
    }
}

impl LogRecordWriter for ExportWriter {
    async fn write(&mut self, record: LogRecordOutput<'_>) -> Result<(), NativeError> {
        if !self.ranges.is_empty() {
            // TODO: we can optimize index search
            if !self
                .ranges
                .iter()
                .any(|range| range.contains(&(self.index as u64)))
            {
                // Skip record because it's not in a range
                self.index += 1;
                return Ok(());
            }
        }
        self.index += 1;
        fn fill<'a>(
            writer: &mut ExportWriter,
            record: LogRecordOutput<'a>,
        ) -> Result<Option<Vec<LogRecordOutput<'a>>>, NativeError> {
            match record {
                LogRecordOutput::Raw(inner) => {
                    writer.buffer.write_all(inner)?;
                    Ok(None)
                }
                LogRecordOutput::Cow(inner) => {
                    writer.buffer.write_all(inner.as_bytes())?;
                    writer.buffer.write_all(&[b'\n'])?;
                    Ok(None)
                }
                LogRecordOutput::String(inner) => {
                    writer.buffer.write_all(inner.as_bytes())?;
                    writer.buffer.write_all(&[b'\n'])?;
                    Ok(None)
                }
                LogRecordOutput::Str(inner) => {
                    writer.buffer.write_all(inner.as_bytes())?;
                    writer.buffer.write_all(&[b'\n'])?;
                    Ok(None)
                }
                LogRecordOutput::Columns(inner) => {
                    writer.buffer.write_all(
                        inner
                            .join(&definitions::COLUMN_SENTINAL.to_string())
                            .as_bytes(),
                    )?;
                    writer.buffer.write_all(&[b'\n'])?;
                    Ok(None)
                }
                LogRecordOutput::Multiple(inner) => Ok(Some(inner)),
                LogRecordOutput::Attachment(_) => {
                    // TODO: report error
                    Ok(None)
                }
            }
        }
        if let Some(records) = fill(self, record)? {
            for record in records.into_iter() {
                fill(self, record)?;
            }
        }
        Ok(())
    }
    async fn finalize(&mut self) -> Result<(), stypes::NativeError> {
        self.buffer.flush()?;
        Ok(())
    }
    fn get_id(&self) -> u16 {
        0
    }
}

pub async fn run_producer<P: Parser, S: ByteSource, W: LogRecordWriter>(
    operation_api: OperationAPI,
    mut producer: MessageProducer<'_, P, S, W>,
) -> OperationResult<bool> {
    operation_api.processing();
    let cancel = operation_api.cancellation_token();
    while let Some(..) = select! {
        next_from_stream = producer.read_next_segment() => next_from_stream,
        _ = async {
            cancel.cancelled().await;
            debug!("exporting operation has been cancelled");
        } => None,
    } {
        // Do nothing. Writing happens on MessageProducer level
    }
    debug!("exporting is done");
    Ok(Some(!cancel.is_cancelled()))
}
