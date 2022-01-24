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
use buf_redux::{policy::MinBuffered, BufReader as ReduxReader};
use crossbeam_channel as cc;
use dlt_core::{
    dlt::Message,
    fibex::{gather_fibex_data, FibexConfig, FibexMetadata},
    filtering,
    fmt::FormattableMessage,
    parse::{dlt_message, DltParseError, ParsedMessage},
    statistics::StatisticInfo,
};
use indexer_base::{
    chunks::{ChunkFactory, ChunkResults},
    config::*,
    progress::*,
    utils,
};
use std::{
    fs,
    io::{BufRead, BufWriter, Read, Seek, Write},
};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Config problem found: {0}")]
    Config(String),
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
    #[error("Utils error: {0:?}")]
    Utils(#[from] indexer_base::utils::Error),
}

pub(crate) const DLT_READER_CAPACITY: usize = 10 * 1024 * 1024;
pub(crate) const DLT_MIN_BUFFER_SPACE: usize = 10 * 1024;
pub(crate) const DLT_PATTERN_SIZE: usize = 4;

pub type StatisticsResults = std::result::Result<IndexingProgress<StatisticInfo>, Notification>;

pub fn create_index_and_mapping_dlt(
    config: IndexingConfig,
    source_file_size: u64,
    dlt_filter: Option<filtering::DltFilterConfig>,
    update_channel: &cc::Sender<ChunkResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
    fibex: Option<FibexConfig>,
) -> Result<(), Error> {
    trace!("create_index_and_mapping_dlt");
    let filter_config: Option<filtering::ProcessedDltFilterConfig> =
        dlt_filter.map(filtering::process_filter_config);
    let fibex_metadata: Option<FibexMetadata> = fibex.and_then(gather_fibex_data);

    let f = fs::File::open(&config.in_file)?;
    let mut message_producer = FileMessageProducer::new(f, filter_config, true, fibex_metadata);
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
pub struct FileMessageProducer<R>
where
    R: Read + Seek + Unpin,
{
    reader: ReduxReader<R, MinBuffered>,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    stats: MessageStats,
    with_storage_header: bool,
    fibex_metadata: Option<FibexMetadata>,
}

impl<R> FileMessageProducer<R>
where
    R: Read + Seek + Unpin,
{
    pub fn new(
        input: R,
        filter_config: Option<filtering::ProcessedDltFilterConfig>,
        with_storage_header: bool,
        fibex_metadata: Option<FibexMetadata>,
    ) -> FileMessageProducer<R> {
        let reader = ReduxReader::with_capacity(DLT_READER_CAPACITY, input)
            .set_policy(MinBuffered(DLT_MIN_BUFFER_SPACE));
        FileMessageProducer {
            reader,
            filter_config,
            stats: MessageStats {
                parsed: 0,
                no_parse: 0,
            },
            with_storage_header,
            fibex_metadata,
        }
    }

    fn fibex(&self) -> Option<&FibexMetadata> {
        self.fibex_metadata.as_ref()
    }

    // Produces the next message in a file or None if the EOF was reached
    fn produce_next_message(&mut self) -> (usize, Result<Option<ParsedMessage>, DltParseError>) {
        #[allow(clippy::never_loop)]
        let consume_and_parse_result: (
            usize,
            Result<Option<ParsedMessage>, DltParseError>,
        ) = loop {
            match self.reader.fill_buf() {
                Ok(content) => {
                    if content.is_empty() {
                        trace!("0, Ok(None)");
                        return (0, Ok(None));
                    }
                    let available = content.len();

                    let parse_result: Result<(&[u8], ParsedMessage), DltParseError> = dlt_message(
                        content,
                        self.filter_config.as_ref(),
                        self.with_storage_header,
                    );

                    match parse_result {
                        Ok((rest, parsed_msg)) => {
                            let consumed = available - rest.len();
                            self.stats.parsed += 1;
                            break (consumed, Ok(Some(parsed_msg)));
                        }
                        Err(DltParseError::IncompleteParse { needed }) => {
                            debug!("parse incomplete");
                            self.stats.no_parse += 1;
                            let needed_s = match needed {
                                Some(s) => format!("{}", s),
                                None => "unknown".to_string(),
                            };
                            break (0, Err(DltParseError::Unrecoverable (
                                format!(
                                    "read_one_dlt_message: imcomplete parsing error for dlt messages: (bytes left: {}, but needed: {})",
                                    content.len(),
                                    needed_s
                                ),
                            )));
                        }
                        Err(DltParseError::ParsingHickup(reason)) => {
                            warn!("parse error");
                            self.stats.no_parse += 1;
                            break (
                                DLT_PATTERN_SIZE,
                                Err(DltParseError::ParsingHickup(format!(
                                    "read_one_dlt_message: parsing error for dlt messages: {}",
                                    reason
                                ))),
                            );
                        }
                        Err(DltParseError::Unrecoverable(cause)) => {
                            warn!("parse failure");
                            self.stats.no_parse += 1;
                            break (
                                0,
                                Err(DltParseError::Unrecoverable(format!(
                                    "read_one_dlt_message: parsing failure for dlt messages: {}",
                                    cause
                                ))),
                            );
                        }
                    }
                }
                Err(e) => {
                    trace!("no more content");
                    break (
                        0,
                        Err(DltParseError::Unrecoverable(format!(
                            "error for filling buffer with dlt messages: {:?}",
                            e
                        ))),
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

impl<R> Iterator for FileMessageProducer<R>
where
    R: Read + Seek + Unpin,
{
    type Item = ParsedMessage;
    fn next(&mut self) -> Option<ParsedMessage> {
        match self.produce_next_message() {
            (_s, Ok(Some(parsed_msg))) => Some(parsed_msg),
            _ => None,
        }
    }
}

impl<R> tokio_stream::Stream for FileMessageProducer<R>
where
    R: Read + Seek + Unpin,
{
    type Item = Result<(usize, Option<Message>), DltParseError>;
    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context,
    ) -> core::task::Poll<Option<Self::Item>> {
        let (consumed, next) = self.produce_next_message();
        match next {
            Ok(Some(ParsedMessage::Item(msg))) => {
                core::task::Poll::Ready(Some(Ok((consumed, Some(msg)))))
            }
            Ok(Some(ParsedMessage::Invalid)) => core::task::Poll::Ready(Some(Ok((consumed, None)))),
            Ok(Some(ParsedMessage::FilteredOut(_))) => {
                core::task::Poll::Ready(Some(Ok((consumed, None))))
            }
            Ok(None) => core::task::Poll::Ready(Some(Ok((consumed, None)))),
            Err(e) => core::task::Poll::Ready(Some(Err(e))),
        }
    }
}

/// create index for a dlt file
/// source_file_size: if progress updates should be made, add this value
#[allow(clippy::cognitive_complexity)]
pub fn index_dlt_content<R: Read + Seek + Unpin>(
    config: IndexingConfig,
    source_file_size: u64,
    update_channel: &cc::Sender<ChunkResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
    message_producer: &mut FileMessageProducer<R>,
) -> Result<(), Error> {
    trace!("index_dlt_file {:?}", config);
    let (out_file, current_out_file_size) =
        utils::get_out_file_and_size(config.append, &config.out_path)?;

    let mut chunk_count = 0usize;
    let mut last_byte_index = 0usize;
    let mut chunk_factory = ChunkFactory::new(config.chunk_size, current_out_file_size);
    let mut line_nr = if config.append {
        utils::next_line_nr(&config.out_path)?
    } else {
        0
    };
    // let tmp_file = create_dlt_tmp_file("file")?;
    // let mut tmp_writer = BufWriter::with_capacity(DLT_READER_CAPACITY, tmp_file);
    let mut buf_writer = BufWriter::with_capacity(DLT_READER_CAPACITY, out_file);

    let mut progress_reporter = ProgressReporter::new(source_file_size, update_channel.clone());

    let mut stopped = false;
    let mut skipped = 0usize;
    'reading_messages: loop {
        if stopped {
            info!("we were stopped in dlt-indexer",);
            break 'reading_messages;
        };
        let (consumed, next) = message_producer.produce_next_message();
        if consumed == 0 {
            break 'reading_messages;
        } else {
            progress_reporter.make_progress(consumed);
        }
        match next {
            Ok(Some(ParsedMessage::Item(msg))) => {
                trace!("[line:{}] next was Ok(ParsedMessage::Item(msg))", line_nr);
                let formattable_msg = FormattableMessage {
                    message: msg,
                    fibex_metadata: message_producer.fibex(),
                    options: None,
                };
                let written_bytes_len = utils::create_tagged_line_d(
                    &config.tag,
                    &mut buf_writer,
                    &formattable_msg,
                    line_nr,
                    true,
                )?;
                // tmp_writer.write_all(&msg.as_bytes())?;
                line_nr += 1;
                if let Some(chunk) = chunk_factory.add_bytes(line_nr, written_bytes_len) {
                    stopped = utils::check_if_stop_was_requested(
                        shutdown_receiver.as_ref(),
                        "dlt indexer",
                    );
                    chunk_count += 1;
                    last_byte_index = chunk.b.1;
                    let _ = update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }));
                    buf_writer.flush()?;
                }
            }
            Ok(Some(ParsedMessage::Invalid)) => {
                trace!("next was Ok(ParsedMessage::Invalid)");
            }
            Ok(Some(ParsedMessage::FilteredOut(_))) => {
                trace!("next was Ok(ParsedMessage::FilteredOut)");
                skipped += 1;
            }
            Ok(None) => {
                trace!("next was OK (EOF)");
                break 'reading_messages;
            }
            Err(e) => match e {
                DltParseError::ParsingHickup(reason) => {
                    warn!(
                        "error parsing 1 dlt message, try to continue parsing: {}",
                        reason
                    );
                }
                e => {
                    warn!("error while parsing: {}", e);
                    let _ = update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content: format!("error while parsing dlt file: {}", e),
                        line: None,
                    }));
                    break 'reading_messages;
                }
            },
        }
    }

    trace!("buf_writer.flush()");
    buf_writer.flush()?;
    // tmp_writer.flush()?;
    if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunk_count == 0) {
        trace!("send chunk {:?}", chunk);
        let _ = update_channel.send(Ok(IndexingProgress::GotItem {
            item: chunk.clone(),
        }));
        chunk_count += 1;
        last_byte_index = chunk.b.1;
    }
    if chunk_count > 0 {
        let last_expected_byte_index = fs::metadata(config.out_path).map(|md| md.len() as usize)?;
        if last_expected_byte_index != last_byte_index {
            let _ = update_channel.send(Err(Notification {
                severity: Severity::ERROR,
                content: format!(
                    "error in computation! last byte in chunks is {} but should be {}",
                    last_byte_index, last_expected_byte_index
                ),
                line: Some(line_nr),
            }));
        }
    }
    debug!(
        "sending IndexingProgress::Finished (skipped {} msgs)",
        skipped
    );
    let _ = update_channel.send(Ok(IndexingProgress::Finished));
    Ok(())
}
