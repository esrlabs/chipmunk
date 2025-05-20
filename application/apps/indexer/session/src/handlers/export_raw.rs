use crate::operations::{OperationAPI, OperationResult};
use components::Components;
use definitions::{ByteSource, LogRecordOutput, LogRecordWriter, Parser};
use log::debug;
use processor::producer::MessageProducer;

use std::{
    fs::File,
    io::{self, BufWriter, Write},
    path::{Path, PathBuf},
    sync::Arc,
};
use stypes::{NativeError, SessionSetup, SourceOrigin};
use tokio::select;

struct ExportWriter {
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
    fn write(&mut self, record: LogRecordOutput<'_>) -> Result<(), NativeError> {
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
        match record {
            LogRecordOutput::Raw(inner) => {
                self.buffer.write_all(inner)?;
            }
            LogRecordOutput::Cow(inner) => {
                self.buffer.write_all(inner.as_bytes())?;
                self.buffer.write_all(&[b'\n'])?;
            }
            LogRecordOutput::String(inner) => {
                self.buffer.write_all(inner.as_bytes())?;
                self.buffer.write_all(&[b'\n'])?;
            }
            LogRecordOutput::Str(inner) => {
                self.buffer.write_all(inner.as_bytes())?;
                self.buffer.write_all(&[b'\n'])?;
            }
            LogRecordOutput::Columns(inner) => {
                self.buffer.write_all(
                    inner
                        .join(&definitions::COLUMN_SENTINAL.to_string())
                        .as_bytes(),
                )?;
                self.buffer.write_all(&[b'\n'])?;
            }
            LogRecordOutput::Multiple(inner) => {
                for record in inner.into_iter() {
                    self.write(record)?;
                }
            }
            LogRecordOutput::Attachment(_) => {
                // TODO: report error
            }
        }
        Ok(())
    }
    fn finalize(&mut self) -> Result<(), stypes::NativeError> {
        self.buffer.flush()?;
        Ok(())
    }
    fn get_id(&self) -> u16 {
        0
    }
}

pub async fn export(
    operation_api: OperationAPI,
    options: SessionSetup,
    components: Arc<Components<sources::Source, parsers::Parser>>,
    out_path: PathBuf,
    ranges: Vec<std::ops::RangeInclusive<u64>>,
) -> OperationResult<bool> {
    match &options.origin {
        SourceOrigin::File(..) => {
            let (_, source, parser) = components.setup(&options)?;
            let mut writer = ExportWriter::new(&out_path, ranges)?;
            let producer = MessageProducer::new(parser, source, &mut writer);
            Ok(run_producer(operation_api, producer).await?)
        }
        SourceOrigin::Source => {
            let (_, source, parser) = components.setup(&options)?;
            let mut writer = ExportWriter::new(&out_path, ranges)?;
            let producer = MessageProducer::new(parser, source, &mut writer);
            Ok(run_producer(operation_api, producer).await?)
        }
        SourceOrigin::Files(files) => {
            // We are creating one single writer for all files to keep tracking ranges and current index
            let mut writer = ExportWriter::new(&out_path, ranges)?;
            for file in files {
                if operation_api.cancellation_token().is_cancelled() {
                    return Ok(Some(false));
                }
                let (_, source, parser) =
                    components.setup(&options.inherit(SourceOrigin::File(file.to_owned())))?;
                let producer = MessageProducer::new(parser, source, &mut writer);
                run_producer(operation_api.clone(), producer).await?;
            }
            Ok(Some(true))
        }
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
