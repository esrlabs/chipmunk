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
use crate::dlt_parse::dlt_message;
use crate::dlt_parse::DLT_PATTERN_SIZE;
use crate::dlt_parse::{DltParseError, ParsedMessage};
use crate::filtering;
use crossbeam_channel as cc;
use indexer_base::chunks::{ChunkResults, ChunkFactory};
use indexer_base::config::*;
use indexer_base::progress::*;
use indexer_base::utils;

use buf_redux::policy::MinBuffered;
use buf_redux::BufReader as ReduxReader;
use failure::{err_msg, Error};
use std::fs;
use std::io::{BufRead, BufWriter, Write};
use std::rc::Rc;

use crate::fibex::FibexMetadata;

pub fn create_index_and_mapping_dlt(
    config: IndexingConfig,
    source_file_size: Option<usize>,
    dlt_filter: Option<filtering::DltFilterConfig>,
    update_channel: &cc::Sender<ChunkResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
    fibex_metadata: Option<FibexMetadata>,
) -> Result<(), Error> {
    trace!("create_index_and_mapping_dlt");
    let filter_config: Option<filtering::ProcessedDltFilterConfig> =
        dlt_filter.map(filtering::process_filter_config);
    let mut message_producer =
        FileMessageProducer::new(&config.in_file, filter_config, update_channel.clone(), true)?;
    index_dlt_content(
        config,
        source_file_size,
        update_channel,
        shutdown_receiver,
        fibex_metadata,
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
}

impl FileMessageProducer {
    fn new(
        in_path: &std::path::PathBuf,
        filter_config: Option<filtering::ProcessedDltFilterConfig>,
        update_channel: cc::Sender<ChunkResults>,
        with_storage_header: bool,
    ) -> Result<FileMessageProducer, Error> {
        let f = match fs::File::open(&in_path) {
            Ok(file) => file,
            Err(e) => {
                eprint!("could not open {:?}", in_path);
                let _ = update_channel.try_send(Err(Notification {
                    severity: Severity::WARNING,
                    content: format!("could not open file ({})", e),
                    line: None,
                }));
                return Err(err_msg(format!("could not open file ({})", e)));
            }
        };
        let reader =
            ReduxReader::with_capacity(10 * 1024 * 1024, f).set_policy(MinBuffered(10 * 1024));
        Ok(FileMessageProducer {
            reader,
            filter_config,
            stats: MessageStats {
                parsed: 0,
                no_parse: 0,
            },
            update_channel,
            with_storage_header,
        })
    }
}
impl FileMessageProducer {
    fn produce_next_message(
        &mut self,
        fibex_metadata: Option<Rc<FibexMetadata>>,
    ) -> (usize, Result<ParsedMessage, DltParseError>) {
        #[allow(clippy::never_loop)]
        let consume_and_parse_result = loop {
            trace!(
                "[parsed:{}/problems:{}] produce_next_message: enter next loop",
                self.stats.parsed,
                self.stats.no_parse
            );
            match self.reader.fill_buf() {
                Ok(content) => {
                    trace!("Ok(content (len {}))", content.len());
                    if content.is_empty() {
                        trace!("0, Ok(ParsedMessage::Invalid)");
                        return (0, Ok(ParsedMessage::Invalid));
                    }
                    let available = content.len();

                    let parse_result: nom::IResult<&[u8], ParsedMessage> = dlt_message(
                        content,
                        self.filter_config.as_ref(),
                        self.stats.parsed + self.stats.no_parse,
                        Some(&self.update_channel),
                        fibex_metadata,
                        self.with_storage_header,
                    );
                    match parse_result {
                        Ok((rest, maybe_msg)) => {
                            let consumed = available - rest.len();
                            self.stats.parsed += 1;
                            trace!("parse ok, consumed: {}", consumed);
                            break (consumed, Ok(maybe_msg));
                        }
                        Err(nom::Err::Incomplete(n)) => {
                            debug!("parse incomplete");
                            self.stats.no_parse += 1;
                            let needed = match n {
                                nom::Needed::Size(s) => format!("{}", s),
                                nom::Needed::Unknown => "unknown".to_string(),
                            };
                            break (0, Err(DltParseError::Unrecoverable {
                                cause: format!(
                                    "read_one_dlt_message: imcomplete parsing error for dlt messages: (bytes left: {}, but needed: {})",
                                    content.len(),
                                    needed
                                ),
                            }));
                        }
                        Err(nom::Err::Error(_e)) => {
                            warn!("parse error");
                            self.stats.no_parse += 1;
                            break (
                                DLT_PATTERN_SIZE,
                                Err(DltParseError::ParsingHickup {
                                    reason: format!(
                                    "read_one_dlt_message: parsing error for dlt messages: {:?}",
                                    _e
                                ),
                                }),
                            );
                        }
                        Err(nom::Err::Failure(_e)) => {
                            warn!("parse failure");
                            self.stats.no_parse += 1;
                            break (
                                0,
                                Err(DltParseError::Unrecoverable {
                                    cause: format!(
                                    "read_one_dlt_message: parsing failure for dlt messages: {:?}",
                                    _e
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

/// create index for a dlt file
/// source_file_size: if progress updates should be made, add this value
#[allow(clippy::cognitive_complexity)]
pub fn index_dlt_content(
    config: IndexingConfig,
    source_file_size: Option<usize>,
    update_channel: &cc::Sender<ChunkResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
    fibex_metadata: Option<FibexMetadata>,
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
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);

    let mut progress_reporter = ProgressReporter::new(source_file_size, update_channel.clone());
    let fibex_rc = fibex_metadata.map(Rc::new);

    let mut stopped = false;
    let mut skipped = 0usize;
    loop {
        if stopped {
            info!("we were stopped in dlt-indexer",);
            break;
        };
        let (consumed, next) = message_producer.produce_next_message(fibex_rc.clone());
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
                trace!("written_bytes_len: {}", written_bytes_len);
                line_nr += 1;
                if let Some(chunk) =
                    chunk_factory.create_chunk_if_needed(line_nr, written_bytes_len)
                {
                    // check if stop was requested
                    if let Some(rx) = shutdown_receiver.as_ref() {
                        match rx.try_recv() {
                            // Shutdown if we have received a command or if there is
                            // nothing to send it.
                            Ok(_) | Err(cc::TryRecvError::Disconnected) => {
                                info!("shutdown received in indexer",);
                                stopped = true // stop
                            }
                            // No shutdown command, continue
                            Err(cc::TryRecvError::Empty) => (),
                        }
                    };
                    chunk_count += 1;
                    last_byte_index = chunk.b.1;
                    trace!("1 send chunk {:?}", chunk);
                    update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }))?;
                    buf_writer.flush()?;
                }
                trace!("end foobar");
            }
            Ok(ParsedMessage::Invalid) => {
                trace!("next was Ok(ParsedMessage::Invalid)");
            }
            Ok(ParsedMessage::Skipped) => {
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
                    warn!("cannot continue parsing: {}", cause);
                    update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content: format!("error parsing dlt file: {}", cause),
                        line: None,
                    }))?;
                    break;
                }
            },
        }
    }

    trace!("buf_writer.flush()");
    buf_writer.flush()?;
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
