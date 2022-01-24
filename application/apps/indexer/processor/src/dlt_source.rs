use crate::grabber::{
    identify_byte_range, ByteRange, GrabError, GrabMetadata, GrabbedContent, GrabbedElement,
    LineRange, MetadataSource, Slot,
};
use buf_redux::{policy::MinBuffered, BufReader as ReduxReader};
use dlt_core::{dlt::Message, parse::dlt_consume_msg};
use indexer_base::progress::ComputationResult;
use parsers::dlt::DltParser;
use sources::{
    producer::{DynamicProducer, MessageProducer, StaticProducer},
    raw::binary::BinaryByteSource,
};
use std::{
    fs,
    io::{BufRead, Cursor, SeekFrom},
    path::{Path, PathBuf},
};
use tokio_util::sync::CancellationToken;

const REDUX_READER_CAPACITY: usize = 17 * 1024 * 1024;
const REDUX_MIN_BUFFER_SPACE: usize = 17 * 1024;
const DEFAULT_SLOT_SIZE: usize = 64 * 1024usize;

#[derive(Debug)]
pub struct DltSource {
    source_id: String,
    path: PathBuf,
    with_storage_header: bool,
}

impl DltSource {
    pub fn new(p: &Path, id: &str, with_storage_header: bool) -> Self {
        Self {
            source_id: id.to_string(),
            path: PathBuf::from(p),
            with_storage_header,
        }
    }
}

impl MetadataSource for DltSource {
    fn source_id(&self) -> String {
        self.source_id.clone()
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn count_lines(&self) -> Result<usize, GrabError> {
        unimplemented!()
    }

    fn from_file(
        &self,
        shutdown_token: Option<CancellationToken>,
    ) -> Result<ComputationResult<GrabMetadata>, GrabError> {
        if !fs::metadata(&self.path)
            .map_err(|_| GrabError::IoOperation("Could not get metadata of file".to_string()))?
            .is_file()
        {
            return Err(GrabError::Config(format!(
                "File {} does not exist",
                self.path.to_string_lossy()
            )));
        }
        let f = fs::File::open(&self.path)
            .map_err(|_| GrabError::IoOperation(format!("Could not open file {:?}", &self.path)))?;
        let mut reader = ReduxReader::with_capacity(REDUX_READER_CAPACITY, f)
            .set_policy(MinBuffered(REDUX_MIN_BUFFER_SPACE));

        let mut slots = Vec::<Slot>::new();
        let mut bytes_offset = 0u64;
        let mut log_msg_cnt: u64 = 0;

        let mut bytes_in_slot = 0u64;
        let mut logs_in_slot = 0u64;
        loop {
            debug!("loop over dlt source");
            if let Some(shutdown_token) = &shutdown_token {
                if shutdown_token.is_cancelled() {
                    return Ok(ComputationResult::Stopped);
                }
            }
            match reader.fill_buf() {
                Ok(content) => {
                    if content.is_empty() {
                        // everything was processed
                        trace!(
                            "content of buffer now empty, we are done, {} bytes left",
                            bytes_in_slot
                        );
                        if bytes_in_slot > 0_u64 {
                            let slot = Slot {
                                bytes: ByteRange::from(
                                    (bytes_offset - bytes_in_slot)..=bytes_offset - 1,
                                ),
                                lines: LineRange::from(log_msg_cnt - logs_in_slot..=log_msg_cnt),
                            };
                            slots.push(slot);
                        }
                        break;
                    }
                    debug!("content content is not empty");
                    if let Ok((_rest, Some(consumed))) = dlt_consume_msg(content) {
                        debug!("dlt_consume_msg consumed {} bytes", consumed);
                        reader.consume(consumed as usize);
                        log_msg_cnt += 1;
                        logs_in_slot += 1;
                        bytes_offset += consumed;
                        bytes_in_slot += consumed;
                        if bytes_in_slot >= DEFAULT_SLOT_SIZE as u64 {
                            let slot = Slot {
                                bytes: ByteRange::from(
                                    (bytes_offset - bytes_in_slot)..=bytes_offset - 1,
                                ),
                                lines: LineRange::from(log_msg_cnt - logs_in_slot..=log_msg_cnt),
                            };
                            slots.push(slot);
                            bytes_in_slot = 0;
                            logs_in_slot = 0;
                        }
                    } else {
                        break;
                    }
                }
                Err(e) => {
                    trace!("no more content");
                    return Err(GrabError::Config(format!(
                        "error for filling buffer with dlt messages: {:?}",
                        e
                    )));
                }
            }
        }
        Ok(ComputationResult::Item(GrabMetadata {
            slots,
            line_count: log_msg_cnt as usize,
        }))
    }

    fn get_entries(
        &self,
        metadata: &GrabMetadata,
        line_range: &LineRange,
    ) -> Result<GrabbedContent, GrabError> {
        if line_range.range.is_empty() {
            return Err(GrabError::InvalidRange {
                range: line_range.clone(),
                context: "range was empty".to_string(),
            });
        }
        use std::io::prelude::*;

        let file_part = identify_byte_range(&metadata.slots, line_range).ok_or_else(|| {
            GrabError::InvalidRange {
                range: line_range.clone(),
                context: "Could not identify byte range".to_string(),
            }
        })?;
        trace!("get_entries, file-part: {:?}", file_part);

        let mut read_buf = vec![0; file_part.length];
        let mut read_from = fs::File::open(&self.path())
            .map_err(|_| GrabError::IoOperation(format!("Could not open file {:?}", &self.path)))?;

        read_from
            .seek(SeekFrom::Start(file_part.offset_in_file))
            .map_err(|_| {
                GrabError::IoOperation(format!("Could not seek in file {:?}", &self.path))
            })?;
        read_from.read_exact(&mut read_buf).map_err(|_| {
            GrabError::IoOperation(format!("Could not read from file {:?}", &self.path))
        })?;

        // let message_stream = FileMessageProducer::new(Cursor::new(read_buf), None, true, None);

        let dlt_parser = DltParser {
            filter_config: None,
            fibex_metadata: None,
            with_storage_header: self.with_storage_header,
        };
        let byte_source = BinaryByteSource::new(Cursor::new(read_buf));
        let mut dlt_msg_producer = StaticProducer::new(dlt_parser, byte_source);

        let mut messages: Vec<Message> = Vec::new();

        // let message_stream = dlt_msg_producer.as_stream();
        todo!("maybe we need to make this async")
        // for msg_result in message_stream {
        //     trace!("got message from stream: {:?}", msg_result);
        //     match msg_result {
        //         ParsedMessage::Item(msg) => {
        //             // progress_reporter.make_progress(consumed);
        //             messages.push(msg)
        //         }
        //         _ => warn!("Could not produce message"),
        //     }
        // }

        // let items_to_grab = line_range.size();
        // let pure_lines = messages
        //     .iter()
        //     .skip(file_part.lines_to_skip)
        //     .take(items_to_grab as usize);

        // let grabbed_elements = pure_lines
        //     .map(|s| {
        //         let fmt_msg = FormattableMessage {
        //             message: s.clone(), //FIXME avoid clone
        //             fibex_metadata: None,
        //             options: None,
        //         };
        //         GrabbedElement {
        //             source_id: self.source_id.clone(),
        //             content: format!("{}", fmt_msg),
        //             row: None,
        //             pos: None,
        //         }
        //     })
        //     .collect::<Vec<GrabbedElement>>();
        // Ok(GrabbedContent { grabbed_elements })
    }
}
