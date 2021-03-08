use crate::grabber::identify_byte_range;
use crate::grabber::GrabError;
use crate::grabber::GrabMetadata;
use crate::grabber::GrabbedContent;
use crate::grabber::GrabbedElement;
use crate::grabber::MetadataSource;
use crate::grabber::Slot;
use crate::grabber::{ByteRange, LineRange};
use buf_redux::{policy::MinBuffered, BufReader as ReduxReader};
use crossbeam_channel::unbounded;
use dlt::dlt::Message;
use dlt::dlt_file::FileMessageProducer;
use dlt::dlt_fmt::FormattableMessage;
use dlt::dlt_parse::{dlt_consume_msg, ParsedMessage};
use indexer_base::chunks::ChunkResults;
use indexer_base::{progress::ComputationResult, utils};
use std::io::Cursor;
use std::{
    fs,
    io::{BufRead, SeekFrom},
    path::{Path, PathBuf},
};

const REDUX_READER_CAPACITY: usize = 10 * 1024 * 1024;
const REDUX_MIN_BUFFER_SPACE: usize = 10 * 1024;
const DEFAULT_SLOT_SIZE: usize = 64 * 1024usize;

pub struct DltSource {
    source_id: String,
    path: PathBuf,
}

impl DltSource {
    pub fn new(p: &Path, id: &str) -> Self {
        Self {
            source_id: id.to_string(),
            path: PathBuf::from(p),
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
        shutdown_receiver: Option<cc::Receiver<()>>,
    ) -> Result<ComputationResult<GrabMetadata>, GrabError> {
        if !fs::metadata(&self.path)?.is_file() {
            return Err(GrabError::Config(format!(
                "File {} does not exist",
                self.path.to_string_lossy()
            )));
        }
        let mut slots = Vec::<Slot>::new();

        let f = fs::File::open(&self.path)?;

        let mut reader = ReduxReader::with_capacity(REDUX_READER_CAPACITY, f)
            .set_policy(MinBuffered(REDUX_MIN_BUFFER_SPACE));

        let mut bytes_in_slot = 0u64;
        let mut bytes_offset = 0u64;
        let mut log_entry_count = 0u64;
        let mut logs_in_slot = 0u64;
        let mut msg_cnt: u64 = 0;
        loop {
            if utils::check_if_stop_was_requested(shutdown_receiver.as_ref(), "grabber") {
                return Ok(ComputationResult::Stopped);
            }
            match reader.fill_buf() {
                Ok(content) => {
                    if content.is_empty() {
                        break;
                    }
                    if let Ok((_rest, Some(consumed))) = dlt_consume_msg(content) {
                        reader.consume(consumed as usize);
                        msg_cnt += 1;
                        logs_in_slot += 1;
                        bytes_offset += consumed;
                        bytes_in_slot += consumed;
                        log_entry_count += 1;
                        if bytes_in_slot >= DEFAULT_SLOT_SIZE as u64 {
                            let slot = Slot {
                                bytes: ByteRange::from(
                                    (bytes_offset - bytes_in_slot)..=bytes_offset,
                                ),
                                lines: LineRange::from(
                                    log_entry_count - logs_in_slot..=log_entry_count,
                                ),
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
            line_count: msg_cnt as usize,
        }))
    }

    fn get_entries(
        &self,
        metadata: &GrabMetadata,
        line_range: &LineRange,
    ) -> Result<GrabbedContent, GrabError> {
        if line_range.range.is_empty() {
            return Err(GrabError::InvalidRange(line_range.clone()));
        }
        use std::io::prelude::*;

        let file_part = identify_byte_range(&metadata.slots, line_range)
            .ok_or_else(|| GrabError::InvalidRange(line_range.clone()))?;
        // println!("file-part: {:?}", file_part);

        let mut read_buf = vec![0; file_part.length];
        let mut read_from = fs::File::open(&self.path())?;

        read_from.seek(SeekFrom::Start(file_part.offset_in_file))?;
        read_from.read_exact(&mut read_buf)?;

        let (tx, _rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
        let message_stream = FileMessageProducer::new(Cursor::new(read_buf), None, tx, true, None);

        let mut messages: Vec<Message> = Vec::new();
        for msg_result in message_stream {
            trace!("got message from stream: {:?}", msg_result);
            match msg_result {
                ParsedMessage::Item(msg) => {
                    // progress_reporter.make_progress(consumed);
                    messages.push(msg)
                }
                _ => warn!("Could not produce message"),
            }
        }

        let items_to_grab = line_range.size();
        let pure_lines = messages
            .iter()
            .skip(file_part.lines_to_skip)
            .take(items_to_grab as usize);

        let grabbed_elements = pure_lines
            .map(|s| {
                let fmt_msg = FormattableMessage {
                    message: s.clone(), //FIXME avoid clone
                    fibex_metadata: None,
                };
                GrabbedElement {
                    source_id: self.source_id.clone(),
                    content: format!("{}", fmt_msg),
                }
            })
            .collect::<Vec<GrabbedElement>>();
        Ok(GrabbedContent { grabbed_elements })
    }
}
