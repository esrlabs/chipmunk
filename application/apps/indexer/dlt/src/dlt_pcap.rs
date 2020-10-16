use crate::{dlt, dlt_parse::*, fibex::FibexMetadata, filtering};
use async_std::task;
use crossbeam_channel as cc;
use etherparse::*;
use futures::{future, stream::StreamExt};
use indexer_base::{
    chunks::{ChunkFactory, ChunkResults},
    config::IndexingConfig,
    progress::*,
    utils,
};
use pcap_parser::{traits::PcapReaderIterator, PcapNGReader, *};
use std::{
    fs::*,
    io::{BufWriter, Write},
    rc::Rc,
    time::{SystemTime, UNIX_EPOCH},
};

struct PcapMessageProducer {
    reader: PcapNGReader<File>,
    index: usize,
    fibex_metadata: Option<Rc<FibexMetadata>>,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
}

impl PcapMessageProducer {
    #![allow(dead_code)]
    pub fn new(
        pcap_path: &std::path::Path,
        fibex_metadata: Option<Rc<FibexMetadata>>,
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
}

#[derive(Debug)]
enum MessageStreamItem {
    Item(Vec<dlt::Message>),
    Skipped,
    Incomplete,
    Done,
}
impl futures::Stream for PcapMessageProducer {
    type Item = Option<(usize, Result<MessageStreamItem, DltParseError>)>;
    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context,
    ) -> futures::task::Poll<Option<Self::Item>> {
        let mut consumed = 0usize;
        let filter_config = self.filter_config.clone();
        let fibex = self.fibex_metadata.clone();
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
                    PcapBlockOwned::NG(Block::SectionHeader(_)) => {
                        trace!("NG SectionHeader");
                        None
                    }
                    PcapBlockOwned::NG(Block::InterfaceDescription(_)) => {
                        trace!("NG InterfaceDescription");
                        None
                    }
                    PcapBlockOwned::NG(Block::NameResolution(h)) => {
                        trace!("NG NameResolution: {} namerecords", h.nr.len());
                        None
                    }
                    PcapBlockOwned::NG(Block::InterfaceStatistics(h)) => {
                        trace!("NG InterfaceStatistics: {:?}", h.options);
                        None
                    }
                    PcapBlockOwned::NG(Block::SystemdJournalExport(_h)) => {
                        trace!("NG SystemdJournalExport");
                        None
                    }
                    PcapBlockOwned::NG(Block::DecryptionSecrets(_h)) => {
                        trace!("NG DecryptionSecrets");
                        None
                    }
                    PcapBlockOwned::NG(Block::Custom(_)) => {
                        trace!("NG Custom");
                        None
                    }
                    PcapBlockOwned::NG(Block::Unknown(_)) => {
                        trace!("NG Unknown");
                        None
                    }
                    PcapBlockOwned::Legacy(_s) => {
                        trace!("LegacyData");
                        None
                    }
                    PcapBlockOwned::LegacyHeader(_s) => {
                        trace!(
                            "LegacyData: version: {}.{}",
                            _s.version_major,
                            _s.version_minor
                        );
                        None
                    }
                };
                if let Some(payload) = data {
                    match SlicedPacket::from_ethernet(&payload) {
                        Err(value) => futures::task::Poll::Ready(Some(Some((
                            consumed,
                            Err(DltParseError::ParsingHickup {
                                reason: format!(
                                    "error trying to extract data from ethernet frame: {}",
                                    value
                                ),
                            }),
                        )))),
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
                                    fibex.clone(),
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
                                    Ok((_, ParsedMessage::FilteredOut)) => {
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
                                    futures::task::Poll::Ready(Some(Some((
                                        consumed,
                                        Ok(MessageStreamItem::Skipped),
                                    ))))
                                } else {
                                    futures::task::Poll::Ready(Some(None))
                                }
                            } else {
                                futures::task::Poll::Ready(Some(Some((
                                    consumed,
                                    Ok(MessageStreamItem::Item(found_dlt_messages)),
                                ))))
                            }
                        }
                    }
                } else {
                    futures::task::Poll::Ready(Some(None))
                }
            }
            Err(PcapError::Eof) => {
                trace!("Pcap: EOF");
                futures::task::Poll::Ready(Some(Some((consumed, Ok(MessageStreamItem::Done)))))
            }
            Err(PcapError::Incomplete) => {
                trace!("Pcap: Incomplete");
                let _ = self.reader.refill();
                futures::task::Poll::Ready(Some(Some((
                    consumed,
                    Ok(MessageStreamItem::Incomplete),
                ))))
            }
            Err(e) => {
                warn!("Pcap: error {:?}", e);
                futures::task::Poll::Ready(Some(Some((
                    consumed,
                    Err(DltParseError::Unrecoverable {
                        cause: format!("error reading pcap: {:?}", e),
                    }),
                ))))
            }
        };
        self.reader.consume(consumed);
        res
    }
}

/// convert a PCAPNG file to a dlt file
#[allow(clippy::too_many_arguments)]
pub fn pcap_to_dlt(
    pcap_path: &std::path::Path,
    out_path: &std::path::Path,
    dlt_filter: Option<filtering::DltFilterConfig>,
    update_channel: cc::Sender<ChunkResults>,
    shutdown_receiver: async_std::sync::Receiver<()>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
) -> Result<(), DltParseError> {
    trace!("Starting pcap_to_dlt");

    let filter_config: Option<filtering::ProcessedDltFilterConfig> =
        dlt_filter.map(filtering::process_filter_config);
    let pcap_file_size = pcap_path.metadata()?.len();
    let progress = |consumed| {
        let _ = update_channel.send(Ok(IndexingProgress::Progress {
            ticks: (consumed as u64, pcap_file_size),
        }));
    };
    let (out_file, _current_out_file_size) = utils::get_out_file_and_size(false, out_path)?;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);

    let pcap_msg_producer = PcapMessageProducer::new(pcap_path, fibex_metadata, filter_config)?;
    // listen for both a shutdown request and incomming messages
    // to do this we need to select over streams of the same type
    // the type we use to unify is this Event enum
    #[derive(Debug)]
    enum Event {
        Shutdown,
        Msg(Result<MessageStreamItem, DltParseError>, usize),
    }
    let shutdown_stream = shutdown_receiver.map(|_| {
        debug!("Received a shutdown event");
        Event::Shutdown
    });
    let filtered_stream = pcap_msg_producer.filter_map(future::ready);
    let message_stream = filtered_stream.map(|(consumed, m)| Event::Msg(m, consumed));
    let mut event_stream = futures::stream::select(message_stream, shutdown_stream);

    let mut processed_bytes = 0usize;
    let mut parsing_hickups = 0usize;
    let mut unrecoverable_parse_errors = 0usize;
    let mut incomplete_parses = 0usize;
    let mut stopped = false;
    task::block_on(async {
        while let Some(event) = event_stream.next().await {
            if let Event::Msg(_, consumed) = event {
                if consumed > 0 {
                    processed_bytes += consumed;
                    progress(processed_bytes);
                }
            }
            match event {
                Event::Shutdown => {
                    debug!("pcap_as_dlt: received shutdown through future channel");
                    let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                    stopped = true;
                    break;
                }
                Event::Msg(Ok(MessageStreamItem::Item(msgs)), _) => {
                    trace!("pcap_as_dlt: received msg event");

                    for msg in msgs {
                        let msg_with_storage_header = match msg.storage_header {
                            Some(_) => msg,
                            None => msg.add_storage_header(None),
                        };
                        let msg_bytes = msg_with_storage_header.as_bytes();
                        buf_writer.write_all(&msg_bytes)?;
                    }
                }
                Event::Msg(Ok(MessageStreamItem::Skipped), _) => {
                    trace!("pcap_as_dlt: msg was skipped due to filters");
                }
                Event::Msg(Ok(MessageStreamItem::Incomplete), consumed) => {
                    trace!(
                        "pcap_as_dlt: msg was incomplete (consumed {} bytes)",
                        consumed
                    );
                }
                Event::Msg(Ok(MessageStreamItem::Done), _) => {
                    trace!("pcap_as_dlt: MessageStreamItem::Done received");
                    let _ = update_channel.send(Ok(IndexingProgress::Finished));
                    break;
                }
                Event::Msg(Err(DltParseError::ParsingHickup { reason }), _) => {
                    warn!("pcap_as_dlt: Parsing hickup error in stream: {}", reason);
                    parsing_hickups += 1;
                }
                Event::Msg(Err(DltParseError::Unrecoverable { cause }), _) => {
                    warn!("Unrecoverable error in stream: {}", cause);
                    unrecoverable_parse_errors += 1;
                }
                Event::Msg(Err(DltParseError::IncompleteParse { needed }), _) => {
                    warn!(
                        "Parsing error in stream, was incomplete: (needed {:?})",
                        needed
                    );
                    incomplete_parses += 1;
                }
            };
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
        buf_writer.flush()?;
        let _ = update_channel.send(Ok(if stopped {
            IndexingProgress::Stopped
        } else {
            IndexingProgress::Finished
        }));
        Ok(())
    })
}

#[allow(clippy::too_many_arguments)]
pub fn index_from_pcap(
    config: IndexingConfig,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    initial_line_nr: usize,
    update_channel: cc::Sender<ChunkResults>,
    shutdown_receiver: async_std::sync::Receiver<()>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
) -> Result<(), DltParseError> {
    trace!("index_from_pcap for  conf: {:?}", config);
    let (out_file, current_out_file_size) =
        utils::get_out_file_and_size(config.append, &config.out_path)?;
    let mut chunk_factory = ChunkFactory::new(config.chunk_size, current_out_file_size);
    let mut line_nr = initial_line_nr;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
    let pcap_file_size = config.in_file.metadata().map(|md| md.len())?;
    let progress = |consumed| {
        let _ = update_channel.send(Ok(IndexingProgress::Progress {
            ticks: (consumed as u64, pcap_file_size),
        }));
    };

    let pcap_msg_producer =
        PcapMessageProducer::new(&config.in_file, fibex_metadata, filter_config)?;
    // listen for both a shutdown request and incomming messages
    // to do this we need to select over streams of the same type
    // the type we use to unify is this Event enum
    #[derive(Debug)]
    enum Event {
        Shutdown,
        Msg(Result<MessageStreamItem, DltParseError>, usize),
    }
    let shutdown_stream = shutdown_receiver.map(|_| {
        debug!("shutdown_receiver event");
        Event::Shutdown
    });
    let filtered_stream = pcap_msg_producer.filter_map(future::ready); // we only want the Some(...) stream elements
    let message_stream = filtered_stream.map(|(consumed, m)| Event::Msg(m, consumed));
    let mut event_stream = futures::stream::select(message_stream, shutdown_stream);
    let mut chunk_count = 0usize;

    let mut processed_bytes = 0usize;
    let mut parsing_hickups = 0usize;
    let mut unrecoverable_parse_errors = 0usize;
    let mut incomplete_parses = 0usize;
    let mut stopped = false;
    task::block_on(async {
        while let Some(event) = event_stream.next().await {
            if let Event::Msg(_, consumed) = event {
                if consumed > 0 {
                    processed_bytes += consumed;
                    progress(processed_bytes);
                }
            }
            match event {
                Event::Shutdown => {
                    debug!("received shutdown through future channel");
                    stopped = true;
                    break;
                }
                Event::Msg(Ok(MessageStreamItem::Item(msgs)), _) => {
                    trace!("received msg event");

                    for msg in msgs {
                        let written_bytes_len = utils::create_tagged_line_d(
                            &config.tag,
                            &mut buf_writer,
                            &msg,
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
                Event::Msg(Ok(MessageStreamItem::Skipped), _) => {
                    trace!("msg was skipped due to filters");
                }
                Event::Msg(Ok(MessageStreamItem::Incomplete), _) => {
                    trace!("msg was incomplete");
                }
                Event::Msg(Ok(MessageStreamItem::Done), _) => {
                    trace!("MessageStreamItem::Done received");
                    buf_writer.flush()?;
                    if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunk_count == 0)
                    {
                        trace!("index: add last chunk {:?}", chunk);
                        let _ = update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }));
                        chunk_count += 1;
                    }
                    break;
                }
                Event::Msg(Err(DltParseError::ParsingHickup { reason }), _) => {
                    warn!("parsing hickup error in stream: {}", reason);
                    parsing_hickups += 1;
                }
                Event::Msg(Err(DltParseError::Unrecoverable { cause }), _) => {
                    warn!("Unrecoverable error in stream: {}", cause);
                    unrecoverable_parse_errors += 1;
                }
                Event::Msg(Err(DltParseError::IncompleteParse { needed }), _) => {
                    warn!(
                        "parse error in stream, was incomplete: (needed {:?})",
                        needed
                    );
                    incomplete_parses += 1;
                }
            };
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
    })
}

pub fn create_index_and_mapping_dlt_from_pcap(
    config: IndexingConfig,
    dlt_filter: Option<filtering::DltFilterConfig>,
    update_channel: &cc::Sender<ChunkResults>,
    shutdown_receiver: async_std::sync::Receiver<()>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
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
                fibex_metadata,
            ) {
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
