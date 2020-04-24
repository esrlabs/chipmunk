// Copyright (c) 2020 E.S.R.Labs. All rights reserved.
//
// NOTICE:  All information contained herein is, and remains
// the property of E.S.R.Labs and its suppliers, if any.
// The intellectual and technical concepts contained herein are
// proprietary to E.S.R.Labs and its suppliers and may be covered
// by German and Foreign Patents, patents in process, and are protected
// by trade secret or copyright law.
// Dissemination of this information or reproduction of this material
// is strictly forbidden unless prior written permission is obtained
// from E.S.R.Labs.
use crate::{
    dlt::Message,
    dlt_parse::{
        dlt_message, forward_to_next_storage_header, skip_storage_header, DltParseError,
        ParsedMessage, DLT_MIN_BUFFER_SPACE, DLT_PATTERN_SIZE, DLT_READER_CAPACITY,
    },
    filtering,
};
use buf_redux::{policy::MinBuffered, BufReader as ReduxReader};
use crossbeam_channel as cc;
use crossbeam_channel::unbounded;
use failure::{err_msg, Error};
use futures::stream::StreamExt;
use indexer_base::{
    chunks::{ChunkFactory, ChunkResults},
    config::*,
    progress::*,
    utils,
};
use std::{
    fs,
    io::{BufRead, BufWriter, Write},
    path::PathBuf,
    rc::Rc,
};

use crate::fibex::FibexMetadata;

pub async fn parse_dlt_file(
    in_file: PathBuf,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
) -> Result<Vec<Message>, Error> {
    trace!("parse_dlt_file");
    let source_file_size = fs::metadata(&in_file)?.len() as usize;
    let (update_channel, _rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
    let mut progress_reporter = ProgressReporter::new(source_file_size, update_channel.clone());
    let mut messages: Vec<Message> = Vec::new();
    let mut message_stream = FileMessageProducer::new(
        &in_file,
        filter_config,
        update_channel.clone(),
        true,
        fibex_metadata,
    )?;
    // type Item = Result<Option<Message>, DltParseError>;
    while let Some(msg_result) = message_stream.next().await {
        trace!("got message from stream: {:?}", msg_result);
        match msg_result {
            Ok((consumed, Some(msg))) => {
                progress_reporter.make_progress(consumed);
                messages.push(msg)
            }
            Ok((consumed, None)) => {
                if consumed == 0 {
                    break;
                }
                progress_reporter.make_progress(consumed);
            }
            Err(e) => warn!("could not produce message: {}", e),
        }
    }
    Ok(messages)
}

pub fn create_index_and_mapping_dlt(
    config: IndexingConfig,
    source_file_size: usize,
    dlt_filter: Option<filtering::DltFilterConfig>,
    update_channel: &cc::Sender<ChunkResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
    fibex_metadata: Option<FibexMetadata>,
) -> Result<(), Error> {
    trace!("create_index_and_mapping_dlt");
    let filter_config: Option<filtering::ProcessedDltFilterConfig> =
        dlt_filter.map(filtering::process_filter_config);
    let mut message_producer = FileMessageProducer::new(
        &config.in_file,
        filter_config,
        update_channel.clone(),
        true,
        fibex_metadata.map(Rc::new),
    )?;
    // TODO do not clone metadata...if we use it in FileMessageProducer, we should not need it in index_dlt_content
    index_dlt_content(
        config,
        source_file_size,
        update_channel,
        shutdown_receiver,
        &mut message_producer,
    )
}

#[derive(Debug)]
pub struct MessageStats {
    parsed: usize,
    no_parse: usize,
}
pub struct FileMessageProducer {
    reader: ReduxReader<fs::File, MinBuffered>,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    stats: MessageStats,
    update_channel: cc::Sender<ChunkResults>,
    with_storage_header: bool,
    fibex_metadata: Option<Rc<FibexMetadata>>,
}

impl FileMessageProducer {
    fn new(
        in_path: &PathBuf,
        filter_config: Option<filtering::ProcessedDltFilterConfig>,
        update_channel: cc::Sender<ChunkResults>,
        with_storage_header: bool,
        fibex_metadata: Option<Rc<FibexMetadata>>,
    ) -> Result<FileMessageProducer, Error> {
        let f = match fs::File::open(&in_path) {
            Ok(file) => file,
            Err(e) => {
                warn!("could not open {:?}", in_path);
                let _ = update_channel.try_send(Err(Notification {
                    severity: Severity::WARNING,
                    content: format!("could not open file ({})", e),
                    line: None,
                }));
                return Err(err_msg(format!("could not open file ({})", e)));
            }
        };
        let reader = ReduxReader::with_capacity(DLT_READER_CAPACITY, f)
            .set_policy(MinBuffered(DLT_MIN_BUFFER_SPACE));
        Ok(FileMessageProducer {
            reader,
            filter_config,
            stats: MessageStats {
                parsed: 0,
                no_parse: 0,
            },
            update_channel,
            with_storage_header,
            fibex_metadata,
        })
    }
}
impl FileMessageProducer {
    fn produce_next_message(&mut self) -> (usize, Result<ParsedMessage, DltParseError>) {
        #[allow(clippy::never_loop)]
        let consume_and_parse_result = loop {
            match self.reader.fill_buf() {
                Ok(content) => {
                    if content.is_empty() {
                        trace!("0, Ok(ParsedMessage::Invalid)");
                        return (0, Ok(ParsedMessage::Invalid));
                    }
                    let available = content.len();

                    let parse_result: Result<(&[u8], ParsedMessage), DltParseError> = dlt_message(
                        content,
                        self.filter_config.as_ref(),
                        self.stats.parsed + self.stats.no_parse,
                        Some(&self.update_channel),
                        self.fibex_metadata.clone(),
                        self.with_storage_header,
                    );

                    match parse_result {
                        Ok((rest, maybe_msg)) => {
                            let consumed = available - rest.len();
                            self.stats.parsed += 1;
                            break (consumed, Ok(maybe_msg));
                        }
                        Err(DltParseError::IncompleteParse { needed }) => {
                            debug!("parse incomplete");
                            self.stats.no_parse += 1;
                            let needed_s = match needed {
                                Some(s) => format!("{}", s),
                                None => "unknown".to_string(),
                            };
                            break (0, Err(DltParseError::Unrecoverable {
                                cause: format!(
                                    "read_one_dlt_message: imcomplete parsing error for dlt messages: (bytes left: {}, but needed: {})",
                                    content.len(),
                                    needed_s
                                ),
                            }));
                        }
                        Err(DltParseError::ParsingHickup { reason }) => {
                            warn!("parse error");
                            self.stats.no_parse += 1;
                            break (
                                DLT_PATTERN_SIZE,
                                Err(DltParseError::ParsingHickup {
                                    reason: format!(
                                        "read_one_dlt_message: parsing error for dlt messages: {}",
                                        reason
                                    ),
                                }),
                            );
                        }
                        Err(DltParseError::Unrecoverable { cause }) => {
                            warn!("parse failure");
                            self.stats.no_parse += 1;
                            break (
                                0,
                                Err(DltParseError::Unrecoverable {
                                    cause: format!(
                                    "read_one_dlt_message: parsing failure for dlt messages: {}",
                                    cause
                                ),
                                }),
                            );
                        }
                    }
                }
                Err(e) => {
                    trace!("no more content");
                    break (
                        0,
                        Err(DltParseError::Unrecoverable {
                            cause: format!("error for filling buffer with dlt messages: {:?}", e),
                        }),
                    );
                }
            }
        };
        self.reader.consume(consume_and_parse_result.0);
        trace!(
            "produce_next_message (consumed {})",
            consume_and_parse_result.0
        );
        consume_and_parse_result
    }
}
impl futures::Stream for FileMessageProducer {
    type Item = Result<(usize, Option<Message>), DltParseError>;
    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context,
    ) -> futures::task::Poll<Option<Self::Item>> {
        let (consumed, next) = self.produce_next_message();
        match next {
            Ok(ParsedMessage::Item(msg)) => {
                futures::task::Poll::Ready(Some(Ok((consumed, Some(msg)))))
            }
            Ok(ParsedMessage::Invalid) => futures::task::Poll::Ready(Some(Ok((consumed, None)))),
            Ok(ParsedMessage::FilteredOut) => {
                futures::task::Poll::Ready(Some(Ok((consumed, None))))
            }
            Err(e) => futures::task::Poll::Ready(Some(Err(e))),
        }
    }
}

/// create index for a dlt file
/// source_file_size: if progress updates should be made, add this value
#[allow(clippy::cognitive_complexity)]
pub fn index_dlt_content(
    config: IndexingConfig,
    source_file_size: usize,
    update_channel: &cc::Sender<ChunkResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
    message_producer: &mut FileMessageProducer,
) -> Result<(), Error> {
    trace!("index_dlt_file {:?}", config);
    let (out_file, current_out_file_size) =
        utils::get_out_file_and_size(config.append, &config.out_path)?;

    let mut chunk_count = 0usize;
    let mut last_byte_index = 0usize;
    let mut chunk_factory = ChunkFactory::new(config.chunk_size, current_out_file_size);
    let mut line_nr = if config.append {
        utils::next_line_nr(config.out_path)?
    } else {
        0
    };
    // let tmp_file = create_dlt_tmp_file("file")?;
    // let mut tmp_writer = BufWriter::with_capacity(DLT_READER_CAPACITY, tmp_file);
    let mut buf_writer = BufWriter::with_capacity(DLT_READER_CAPACITY, out_file);

    let mut progress_reporter = ProgressReporter::new(source_file_size, update_channel.clone());

    let mut stopped = false;
    let mut skipped = 0usize;
    loop {
        if stopped {
            info!("we were stopped in dlt-indexer",);
            break;
        };
        let (consumed, next) = message_producer.produce_next_message();
        if consumed == 0 {
            break;
        } else {
            progress_reporter.make_progress(consumed);
        }
        match next {
            Ok(ParsedMessage::Item(msg)) => {
                trace!("[line:{}] next was Ok(ParsedMessage::Item(msg))", line_nr);
                let written_bytes_len =
                    utils::create_tagged_line_d(config.tag, &mut buf_writer, &msg, line_nr, true)?;
                // tmp_writer.write_all(&msg.as_bytes())?;
                line_nr += 1;
                if let Some(chunk) = chunk_factory.add_bytes(line_nr, written_bytes_len) {
                    stopped = utils::check_if_stop_was_requested(&shutdown_receiver, "dlt indexer");
                    chunk_count += 1;
                    last_byte_index = chunk.b.1;
                    update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }))?;
                    buf_writer.flush()?;
                }
            }
            Ok(ParsedMessage::Invalid) => {
                trace!("next was Ok(ParsedMessage::Invalid)");
            }
            Ok(ParsedMessage::FilteredOut) => {
                trace!("next was Ok(ParsedMessage::Skipped)");
                skipped += 1;
            }
            Err(e) => match e {
                DltParseError::ParsingHickup { reason } => {
                    warn!(
                        "error parsing 1 dlt message, try to continue parsing: {}",
                        reason
                    );
                }
                DltParseError::Unrecoverable { cause } => {
                    warn!("dlt_file: cannot continue parsing: {}", cause);
                    update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content: format!("error parsing dlt file: {}", cause),
                        line: None,
                    }))?;
                    break;
                }
                DltParseError::IncompleteParse { needed } => {
                    warn!(
                        "dlt_file: cannot continue parsing, was incomplete: needed {:?}",
                        needed
                    );
                    update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content: format!("error parsing dlt file (incomplete parse): {:?}", needed),
                        line: None,
                    }))?;
                    break;
                }
            },
        }
    }

    trace!("buf_writer.flush()");
    buf_writer.flush()?;
    // tmp_writer.flush()?;
    if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunk_count == 0) {
        trace!("send chunk {:?}", chunk);
        update_channel.send(Ok(IndexingProgress::GotItem {
            item: chunk.clone(),
        }))?;
        chunk_count += 1;
        last_byte_index = chunk.b.1;
    }
    if chunk_count > 0 {
        let last_expected_byte_index = fs::metadata(config.out_path).map(|md| md.len() as usize)?;
        if last_expected_byte_index != last_byte_index {
            update_channel.send(Err(Notification {
                severity: Severity::ERROR,
                content: format!(
                    "error in computation! last byte in chunks is {} but should be {}",
                    last_byte_index, last_expected_byte_index
                ),
                line: Some(line_nr),
            }))?;
        }
    }
    debug!(
        "sending IndexingProgress::Finished (skipped {} msgs)",
        skipped
    );
    update_channel.send(Ok(IndexingProgress::Finished))?;
    Ok(())
}

pub fn export_session_file(
    session_id: String,
    destination_path: PathBuf,
    sections: SectionConfig,
    update_channel: cc::Sender<ChunkResults>,
) -> Result<(), Error> {
    trace!(
        "export_as_dlt_file with id: {} to file: {:?}, exporting {:?}",
        session_id,
        destination_path,
        sections
    );
    let session_file_path = session_file_path(&session_id)?;
    export_as_dlt_file(
        session_file_path,
        destination_path,
        sections,
        update_channel,
    )
}

pub fn export_as_dlt_file(
    dlt_file_path: PathBuf,
    destination_path: PathBuf,
    sections: SectionConfig,
    update_channel: cc::Sender<ChunkResults>,
) -> Result<(), Error> {
    use std::io::{Read, Seek};
    trace!(
        "export_as_dlt_file {:?} to file: {:?}, exporting {:?}",
        dlt_file_path,
        destination_path,
        sections
    );
    if dlt_file_path.exists() {
        trace!("found file to export: {:?}", &dlt_file_path);
        let f = fs::File::open(&dlt_file_path)?;
        let mut reader = &mut std::io::BufReader::new(f);
        let out_file = std::fs::File::create(destination_path)?;
        trace!("created out_file: {:?}", &out_file);
        let partitioner = FilePartitioner::new(&dlt_file_path, sections)?;
        let mut out_writer = BufWriter::new(out_file);

        for part in partitioner.get_parts() {
            trace!("copy part {:?}", part);
            reader.seek(std::io::SeekFrom::Start(part.offset as u64))?;
            let mut take = reader.take(part.length as u64);
            std::io::copy(&mut take, &mut out_writer)?;
            reader = take.into_inner();
            out_writer.flush()?;
        }
        let _ = update_channel.send(Ok(IndexingProgress::Finished));
        Ok(())
    } else {
        let reason = format!("couln't find session file: {:?}", dlt_file_path,);
        let _ = update_channel.send(Err(Notification {
            severity: Severity::ERROR,
            content: reason.clone(),
            line: None,
        }));
        Err(err_msg(reason))
    }
}

pub(crate) fn session_file_path(session_id: &str) -> Result<PathBuf, Error> {
    let home_dir = dirs::home_dir().ok_or_else(|| err_msg("couldn't get home directory"))?;
    let tmp_file_name = format!("{}.dlt", session_id);
    Ok(home_dir
        .join(".chipmunk")
        .join("streams")
        .join(tmp_file_name))
}

pub(crate) fn create_dlt_session_file(session_id: &str) -> Result<std::fs::File, Error> {
    let path = session_file_path(session_id)?;
    Ok(std::fs::File::create(path)?)
}

struct FilePartitioner {
    reader: ReduxReader<fs::File, MinBuffered>,
    offset: u64,
    section_config: SectionConfig,
    file_size: u64,
}
impl FilePartitioner {
    fn new(in_path: &PathBuf, c: SectionConfig) -> Result<Self, Error> {
        let f = fs::File::open(&in_path)?;
        Ok(FilePartitioner {
            reader: ReduxReader::with_capacity(DLT_READER_CAPACITY, f)
                .set_policy(MinBuffered(DLT_MIN_BUFFER_SPACE)),
            offset: 0,
            section_config: c,
            file_size: fs::metadata(in_path)?.len(),
        })
    }
    fn get_parts(mut self) -> Vec<FilePart> {
        if self.section_config.sections.is_empty() {
            return vec![FilePart {
                offset: 0,
                length: self.file_size,
            }];
        }
        #[derive(Debug)]
        struct State {
            index: usize,
            in_section: bool,
            bytes_in_section: u64,
            section_offset: u64,
        }
        let mut result_vec: Vec<FilePart> = vec![];
        let mut state = State {
            index: 0,
            in_section: false,
            bytes_in_section: 0,
            section_offset: 0,
        };
        impl State {
            fn reset_section(&mut self) {
                self.in_section = false;
                self.bytes_in_section = 0;
            }
        }
        for section in self.section_config.sections {
            loop {
                trace!("next[{:?}] (current section {:?})", state.index, section);
                match self.reader.fill_buf() {
                    Ok(content) => {
                        trace!("Ok(content (len {}))", content.len());
                        if content.is_empty() {
                            trace!("0, Ok(ParsedMessage::Invalid)");
                            break;
                        }
                        match skip_storage_header(content) {
                            Ok((rest, skipped_bytes)) => {
                                let (len_without_storage_header, _was_last) =
                                    match forward_to_next_storage_header(rest) {
                                        Some((dropped, _)) => (dropped, false),
                                        None => (rest.len(), true),
                                    };
                                let consumed = skipped_bytes + len_without_storage_header;
                                if state.index == section.first_line {
                                    trace!("---> enter section: {:?}) ({:?})", section, state);
                                    state.in_section = true;
                                    state.section_offset = self.offset;
                                }
                                if state.in_section {
                                    state.bytes_in_section += consumed as u64;
                                }
                                if state.index == section.last_line {
                                    trace!("<--- leaving section: {:?}) ({:?})", section, state);
                                    let res = FilePart {
                                        offset: state.section_offset,
                                        length: state.bytes_in_section,
                                    };
                                    trace!(
                                        "consumed: {}bytes, res: {:?}",
                                        state.bytes_in_section,
                                        &res
                                    );
                                    result_vec.push(res);
                                    state.reset_section();
                                    break;
                                }
                                self.offset += consumed as u64;
                                self.reader.consume(consumed);
                            }
                            Err(_e) => {
                                warn!("error in FilePartitioner forward: {}", _e);
                                break;
                            }
                        }
                    }
                    Err(_e) => {
                        warn!("error in FilePartitioner iterator: {}", _e);
                        break;
                    }
                }
                state.index += 1;
            }
        }
        trace!("result of partition: {:?}", result_vec);
        result_vec
    }
}
#[derive(Debug)]
struct FilePart {
    offset: u64,
    length: u64,
}
