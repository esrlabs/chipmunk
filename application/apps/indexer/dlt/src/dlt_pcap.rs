use crate::dlt_fmt::FormattableMessage;
use crate::fibex::gather_fibex_data;
use crate::{dlt, dlt_parse::*, fibex::FibexMetadata, filtering};
use crossbeam_channel as cc;
use etherparse::*;
use indexer_base::config::FibexConfig;
use indexer_base::{
    chunks::{ChunkFactory, ChunkResults, VoidResults},
    config::IndexingConfig,
    progress::*,
    utils,
};
use pcap_parser::{traits::PcapReaderIterator, PcapNGReader, *};
use std::{
    fs::*,
    io::{BufWriter, Write},
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync;
use tokio_stream::Stream;
use tokio_stream::{wrappers::ReceiverStream, StreamExt};

struct PcapMessageProducer {
    reader: PcapNGReader<File>,
    index: usize,
    fibex_metadata: Option<FibexMetadata>,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
}

impl PcapMessageProducer {
    #![allow(dead_code)]
    pub fn new(
        pcap_path: &std::path::Path,
        fibex_metadata: Option<FibexMetadata>,
        filter_config: Option<filtering::ProcessedDltFilterConfig>,
    ) -> Result<Self, DltParseError> {
        let pcap_file = File::open(&pcap_path)?;
        match PcapNGReader::new(65536, pcap_file) {
            Ok(reader) => Ok(PcapMessageProducer {
                reader,
                index: 0,
                fibex_metadata,
                filter_config,
            }),
            Err(e) => Err(e.into()),
        }
    }

    fn fibex(&self) -> Option<&FibexMetadata> {
        self.fibex_metadata.as_ref()
    }
}

fn debug_block(b: PcapBlockOwned) {
    match b {
        PcapBlockOwned::NG(Block::SectionHeader(_)) => {
            trace!("NG SectionHeader");
        }
        PcapBlockOwned::NG(Block::InterfaceDescription(_)) => {
            trace!("NG InterfaceDescription");
        }
        PcapBlockOwned::NG(Block::NameResolution(h)) => {
            trace!("NG NameResolution: {} namerecords", h.nr.len());
        }
        PcapBlockOwned::NG(Block::InterfaceStatistics(h)) => {
            trace!("NG InterfaceStatistics: {:?}", h.options);
        }
        PcapBlockOwned::NG(Block::SystemdJournalExport(_h)) => {
            trace!("NG SystemdJournalExport");
        }
        PcapBlockOwned::NG(Block::DecryptionSecrets(_h)) => {
            trace!("NG DecryptionSecrets");
        }
        PcapBlockOwned::NG(Block::Custom(_)) => {
            trace!("NG Custom");
        }
        PcapBlockOwned::NG(Block::Unknown(_)) => {
            trace!("NG Unknown");
        }
        PcapBlockOwned::Legacy(_s) => {
            trace!("LegacyData");
        }
        PcapBlockOwned::LegacyHeader(_s) => {
            trace!(
                "LegacyData: version: {}.{}",
                _s.version_major,
                _s.version_minor
            );
        }
        _ => trace!("unknown block"),
    }
}

#[derive(Debug)]
enum MessageStreamItem {
    Item(Vec<dlt::Message>),
    Skipped,
    Incomplete,
    Empty,
    Done,
}
impl Stream for PcapMessageProducer {
    type Item = (usize, Result<MessageStreamItem, DltParseError>);
    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context,
    ) -> core::task::Poll<Option<Self::Item>> {
        let mut consumed = 0usize;
        let filter_config = self.filter_config.clone();
        let index = self.index;
        self.index += 1;
        let now = SystemTime::now();
        let since_the_epoch = now
            .duration_since(UNIX_EPOCH)
            .unwrap_or_else(|_| std::time::Duration::from_secs(0));
        let mut last_in_ms = since_the_epoch.as_millis() as i64;
        let res = match self.reader.next() {
            Ok((offset, block)) => {
                consumed = offset;
                let data = match block {
                    PcapBlockOwned::NG(Block::EnhancedPacket(ref epb)) => {
                        let ts_us: i64 = (epb.ts_high as i64) << 32 | epb.ts_low as i64;
                        last_in_ms = ts_us / 1000;
                        Some(epb.data)
                    }
                    PcapBlockOwned::NG(Block::SimplePacket(ref spb)) => {
                        trace!("SimplePacket");
                        Some(spb.data)
                    }
                    other_type => {
                        debug_block(other_type);
                        None
                    }
                };
                if let Some(payload) = data {
                    match SlicedPacket::from_ethernet(&payload) {
                        Err(value) => core::task::Poll::Ready(Some((
                            consumed,
                            Err(DltParseError::ParsingHickup(format!(
                                "error trying to extract data from ethernet frame: {}",
                                value
                            ))),
                        ))),
                        Ok(value) => {
                            let mut input_slice = value.payload;
                            let mut found_dlt_messages = vec![];
                            let mut skipped = 0usize;
                            while !input_slice.is_empty() {
                                match dlt_message(
                                    input_slice,
                                    filter_config.as_ref(),
                                    index,
                                    None, // we do not want updates reported by the parser itself
                                    false,
                                ) {
                                    Ok((rest, ParsedMessage::Item(m))) => {
                                        trace!("Extracted a valid DLT message");
                                        let msg_with_storage_header = m.add_storage_header(Some(
                                            dlt::DltTimeStamp::from_ms(last_in_ms as u64),
                                        ));
                                        input_slice = rest;
                                        found_dlt_messages.push(msg_with_storage_header);
                                    }
                                    Ok((_, ParsedMessage::FilteredOut(_))) => {
                                        skipped += 1;
                                    }
                                    Ok((_, ParsedMessage::Invalid)) => (),
                                    Err(e) => {
                                        trace!("PCAP payload did not contain a valid DLT message, error: {}", e);
                                        break;
                                    }
                                }
                            }
                            if found_dlt_messages.is_empty() {
                                if skipped > 0 {
                                    core::task::Poll::Ready(Some((
                                        consumed,
                                        Ok(MessageStreamItem::Skipped),
                                    )))
                                } else {
                                    core::task::Poll::Ready(Some((
                                        consumed,
                                        Ok(MessageStreamItem::Empty),
                                    )))
                                }
                            } else {
                                core::task::Poll::Ready(Some((
                                    consumed,
                                    Ok(MessageStreamItem::Item(found_dlt_messages)),
                                )))
                            }
                        }
                    }
                } else {
                    core::task::Poll::Ready(Some((consumed, Ok(MessageStreamItem::Empty))))
                }
            }
            Err(PcapError::Eof) => {
                trace!("Pcap: EOF");
                core::task::Poll::Ready(Some((consumed, Ok(MessageStreamItem::Done))))
            }
            Err(PcapError::Incomplete) => {
                trace!("Pcap: Incomplete");
                let _ = self.reader.refill();
                core::task::Poll::Ready(Some((consumed, Ok(MessageStreamItem::Incomplete))))
            }
            Err(e) => {
                warn!("Pcap: error {:?}", e);
                core::task::Poll::Ready(Some((
                    consumed,
                    Err(DltParseError::Unrecoverable(format!(
                        "error reading pcap: {:?}",
                        e
                    ))),
                )))
            }
        };
        self.reader.consume(consumed);
        res
    }
}

/// convert a PCAPNG file to a dlt file
#[allow(clippy::too_many_arguments)]
pub async fn pcap_to_dlt(
    pcap_path: &std::path::Path,
    out_path: &std::path::Path,
    dlt_filter: Option<filtering::DltFilterConfig>,
    update_channel: cc::Sender<VoidResults>,
    shutdown_receiver: sync::mpsc::Receiver<()>,
    fibex: Option<FibexConfig>,
) -> Result<(), DltParseError> {
    trace!("Starting pcap_to_dlt");

    let filter_config: Option<filtering::ProcessedDltFilterConfig> =
        dlt_filter.map(filtering::process_filter_config);
    let fibex_metadata: Option<FibexMetadata> = fibex.map(gather_fibex_data).flatten();
    let pcap_file_size = pcap_path.metadata()?.len();
    let progress = |consumed: usize| {
        let _ = update_channel.send(Ok(IndexingProgress::Progress {
            ticks: (consumed as u64, pcap_file_size),
        }));
    };
    let (out_file, _current_out_file_size) = utils::get_out_file_and_size(false, out_path)?;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);

    let mut pcap_msg_producer = PcapMessageProducer::new(pcap_path, fibex_metadata, filter_config)?;
    // listen for both a shutdown request and incomming messages
    // to do this we need to select over streams of the same type
    // the type we use to unify is this Event enum

    let mut shutdown_stream = ReceiverStream::new(shutdown_receiver);

    let mut processed_bytes = 0usize;
    let mut parsing_hickups = 0usize;
    let mut unrecoverable_parse_errors = 0usize;
    let mut incomplete_parses = 0usize;
    let mut stopped = false;

    loop {
        tokio::select! {
            _ = shutdown_stream.next() => {
                    warn!("received shutdown through future channel");
                    let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                    stopped = true;
                    break;
            }
            item = pcap_msg_producer.next() => {
                match item {
                    Some((consumed, msg)) => {
                        match msg {
                            Ok(MessageStreamItem::Item(msgs)) => {
                                trace!("pcap_as_dlt: Received msg event");
                                if consumed > 0 {
                                    processed_bytes += consumed;
                                    progress(processed_bytes);
                                }
                                for msg in msgs {
                                    let msg_with_storage_header = match msg.storage_header {
                                        Some(_) => msg,
                                        None => msg.add_storage_header(None),
                                    };
                                    let msg_bytes = msg_with_storage_header.as_bytes();
                                    buf_writer.write_all(&msg_bytes)?;
                                }
                            }
                            Ok(MessageStreamItem::Skipped) => {
                                trace!("pcap_as_dlt: Msg was skipped due to filters");
                            }
                            Ok(MessageStreamItem::Empty) => {
                                trace!("pcap_as_dlt: pcap frame did not contain a message");
                            }
                            Ok(MessageStreamItem::Incomplete) => {
                                trace!(
                                    "pcap_as_dlt: Msg was incomplete (consumed {} bytes)",
                                    consumed
                                );
                            }
                            Ok(MessageStreamItem::Done) => {
                                trace!("pcap_as_dlt: MessageStreamItem::Done received");
                                let _ = update_channel.send(Ok(IndexingProgress::Finished));
                                break;
                            }
                            Err(DltParseError::ParsingHickup ( reason )) => {
                                warn!("pcap_as_dlt: Parsing hickup error in stream: {}", reason);
                                parsing_hickups += 1;
                            }
                            Err(DltParseError::Unrecoverable ( cause )) => {
                                warn!("Unrecoverable error in stream: {}", cause);
                                unrecoverable_parse_errors += 1;
                            }
                            Err(DltParseError::IncompleteParse { needed }) => {
                                warn!(
                                    "Parsing error in stream, was incomplete: (needed {:?})",
                                    needed
                                );
                                incomplete_parses += 1;
                            }
                        }
                    }
                    _ => {
                        // stream was terminated
                        warn!("stream was terminated");
                        break;
                    }
                }
            }
        } // select!
    } // loop
    if unrecoverable_parse_errors > 0 {
        let _ = update_channel.send(Err(Notification {
            severity: Severity::WARNING,
            content: format!("parsing failed for {} messages", unrecoverable_parse_errors),
            line: None,
        }));
    }
    if parsing_hickups > 0 {
        let _ = update_channel.send(Err(Notification {
            severity: Severity::WARNING,
            content: format!("parsing hickup for {} messages", parsing_hickups),
            line: None,
        }));
    }
    if incomplete_parses > 0 {
        let _ = update_channel.send(Err(Notification {
            severity: Severity::WARNING,
            content: format!("parsing incomplete for {} messages", incomplete_parses),
            line: None,
        }));
    }
    buf_writer.flush()?;
    let _ = update_channel.send(Ok(if stopped {
        IndexingProgress::Stopped
    } else {
        IndexingProgress::Finished
    }));
    Ok(())
}

// make async
#[allow(clippy::too_many_arguments)]
pub async fn index_from_pcap(
    config: IndexingConfig,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    initial_line_nr: usize,
    update_channel: cc::Sender<ChunkResults>,
    shutdown_receiver: sync::mpsc::Receiver<()>,
    fibex: Option<FibexConfig>,
) -> Result<(), DltParseError> {
    trace!("index_from_pcap for  conf: {:?}", config);
    let fibex_metadata: Option<FibexMetadata> = fibex.map(gather_fibex_data).flatten();
    let (out_file, current_out_file_size) =
        utils::get_out_file_and_size(config.append, &config.out_path)?;
    let mut chunk_factory = ChunkFactory::new(config.chunk_size, current_out_file_size);
    let mut line_nr = initial_line_nr;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
    let pcap_file_size = config.in_file.metadata().map(|md| md.len())?;
    let progress = |consumed: usize| {
        let _ = update_channel.send(Ok(IndexingProgress::Progress {
            ticks: (consumed as u64, pcap_file_size),
        }));
    };

    let mut pcap_msg_producer =
        PcapMessageProducer::new(&config.in_file, fibex_metadata, filter_config)?;
    // listen for both a shutdown request and incomming messages
    // to do this we need to select over streams of the same type
    // the type we use to unify is this Event enum
    let mut shutdown_stream = ReceiverStream::new(shutdown_receiver);
    // we only want the Some(...) stream elements

    let mut chunk_count = 0usize;

    let mut processed_bytes = 0usize;
    let mut parsing_hickups = 0usize;
    let mut unrecoverable_parse_errors = 0usize;
    let mut incomplete_parses = 0usize;
    let mut stopped = false;

    loop {
        tokio::select! {
            _ = shutdown_stream.next() => {
                    debug!("received shutdown through future channel");
                    stopped = true;
                    let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                    break;
            }
            item = pcap_msg_producer.next() => {
                match item {
                    Some((consumed, msg)) => {
                        if consumed > 0 {
                            processed_bytes += consumed;
                            progress(processed_bytes);
                        }
                        match msg {
                            Ok(MessageStreamItem::Item(msgs)) => {
                                trace!("received msg event");

                                for msg in msgs {
                                    let formattable_msg = FormattableMessage { message: msg, fibex_metadata: pcap_msg_producer.fibex() };
                                    let written_bytes_len = utils::create_tagged_line_d(
                                        &config.tag,
                                        &mut buf_writer,
                                        &formattable_msg,
                                        line_nr,
                                        true,
                                    )?;
                                    line_nr += 1;
                                    if let Some(chunk) = chunk_factory.add_bytes(line_nr, written_bytes_len) {
                                        buf_writer.flush()?;
                                        chunk_count += 1;
                                        let _ =
                                            update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }));
                                    }
                                }
                            }
                            Ok(MessageStreamItem::Skipped) => {
                                trace!("msg was skipped due to filters");
                            }
                            Ok(MessageStreamItem::Empty) => {
                                trace!("pcap_as_dlt: pcap frame did not contain a message");
                            }
                            Ok(MessageStreamItem::Incomplete) => {
                                trace!("msg was incomplete");
                            }
                            Ok(MessageStreamItem::Done) => {
                                trace!("MessageStreamItem::Done received");
                                buf_writer.flush()?;
                                if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunk_count == 0)
                                {
                                    trace!("index: add last chunk {:?}", chunk);
                                    let _ = update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }));
                                }
                                break;
                            }
                            Err(DltParseError::ParsingHickup ( reason )) => {
                                warn!("parsing hickup error in stream: {}", reason);
                                parsing_hickups += 1;
                            }
                            Err(DltParseError::Unrecoverable ( cause )) => {
                                warn!("Unrecoverable error in stream: {}", cause);
                                unrecoverable_parse_errors += 1;
                            }
                            Err(DltParseError::IncompleteParse { needed }) => {
                                warn!(
                                    "parse error in stream, was incomplete: (needed {:?})",
                                    needed
                                );
                                incomplete_parses += 1;
                            }
                        };
                    }
                    _ => {
                        // stream was terminated
                        warn!("stream was terminated...");
                        break;
                    }
                }
            }
        }
    }

    if unrecoverable_parse_errors > 0 {
        let _ = update_channel.send(Err(Notification {
            severity: Severity::WARNING,
            content: format!("parsing failed for {} messages", unrecoverable_parse_errors),
            line: None,
        }));
    }
    if parsing_hickups > 0 {
        let _ = update_channel.send(Err(Notification {
            severity: Severity::WARNING,
            content: format!("parsing hickup for {} messages", parsing_hickups),
            line: None,
        }));
    }
    if incomplete_parses > 0 {
        let _ = update_channel.send(Err(Notification {
            severity: Severity::WARNING,
            content: format!("parsing incomplete for {} messages", incomplete_parses),
            line: None,
        }));
    }
    let _ = update_channel.send(Ok(if stopped {
        IndexingProgress::Stopped
    } else {
        IndexingProgress::Finished
    }));
    Ok(())
}

pub async fn create_index_and_mapping_dlt_from_pcap(
    config: IndexingConfig,
    dlt_filter: Option<filtering::DltFilterConfig>,
    update_channel: &cc::Sender<ChunkResults>,
    shutdown_receiver: sync::mpsc::Receiver<()>,
    fibex: Option<FibexConfig>,
) -> Result<(), DltParseError> {
    trace!("create_index_and_mapping_dlt_from_pcap");
    match utils::next_line_nr(&config.out_path) {
        Ok(initial_line_nr) => {
            let filter_config: Option<filtering::ProcessedDltFilterConfig> =
                dlt_filter.map(filtering::process_filter_config);

            match index_from_pcap(
                config,
                filter_config,
                initial_line_nr,
                update_channel.clone(),
                shutdown_receiver,
                fibex,
            )
            .await
            {
                Ok(()) => Ok(()),
                Err(e) => {
                    let content = format!("{}", e);
                    let _ = update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content,
                        line: None,
                    }));
                    Err(e)
                }
            }
        }
        Err(e) => {
            let content = format!(
                "could not determine last line number of {:?} ({})",
                config.out_path, e
            );
            let _ = update_channel.send(Err(Notification {
                severity: Severity::ERROR,
                content,
                line: None,
            }));
            Err(e.into())
        }
    }
}
