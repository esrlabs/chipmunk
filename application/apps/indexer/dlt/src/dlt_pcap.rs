use crate::dlt::*;
use crate::dlt_parse::*;
use crate::fibex::FibexMetadata;
use crate::filtering;
use async_std::task;
use crossbeam_channel as cc;
use etherparse::*;
use failure::err_msg;
use failure::Error;
use futures::stream::StreamExt;
use indexer_base::chunks::{ChunkFactory, ChunkResults};
use indexer_base::config::IndexingConfig;
use indexer_base::progress::*;
use indexer_base::utils;
use pcap_parser::traits::PcapReaderIterator;
use pcap_parser::PcapNGReader;
use pcap_parser::*;
use std::fs::*;
use std::io::{BufWriter, Write};
use std::rc::Rc;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn convert_to_dlt_file(
    pcap_path: std::path::PathBuf,
    dlt_filter: Option<filtering::DltFilterConfig>,
    update_channel: cc::Sender<ChunkResults>,
    fibex: Option<Rc<FibexMetadata>>,
) -> Result<(), Error> {
    let filter_config: Option<filtering::ProcessedDltFilterConfig> =
        dlt_filter.map(filtering::process_filter_config);
    let ending = &pcap_path
        .extension()
        .ok_or_else(|| err_msg("could not get extension"))?;
    trace!(
        "convert_to_dlt_file({:?}) with ending: {:?}",
        pcap_path,
        ending
    );

    if ending.to_str() == Some("pcapng") {
        trace!("was ng format");
    } else {
        trace!("was legacy format");
    };
    let mut pcap_producer =
        PcapMessageProducer::new(&pcap_path, update_channel, fibex, filter_config)?;
    task::block_on(async {
        while let Some(item) = pcap_producer.next().await {
            match item {
                Ok(MessageStreamItem::Item(i)) => trace!("item: {:?}", i),
                Ok(MessageStreamItem::Done) => {
                    trace!("DONE");
                    break;
                }
                x => trace!("other: {:?}", x),
            }
        }
        trace!("done processing");
    });
    Ok(())
}

struct PcapMessageProducer {
    reader: PcapNGReader<File>,
    update_channel: cc::Sender<ChunkResults>,
    index: usize,
    fibex_metadata: Option<Rc<FibexMetadata>>,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
}

impl PcapMessageProducer {
    #![allow(dead_code)]
    pub fn new(
        pcap_path: &std::path::PathBuf,
        update_channel: cc::Sender<ChunkResults>,
        fibex_metadata: Option<Rc<FibexMetadata>>,
        filter_config: Option<filtering::ProcessedDltFilterConfig>,
    ) -> Result<Self, Error> {
        let pcap_file = File::open(&pcap_path)?;
        match PcapNGReader::new(65536, pcap_file) {
            Ok(reader) => Ok(PcapMessageProducer {
                reader,
                index: 0,
                update_channel,
                fibex_metadata,
                filter_config,
            }),
            Err(e) => Err(err_msg(format!("{:?}", e))),
        }
    }
}

#[derive(Debug)]
enum MessageStreamItem {
    Item(Message),
    Skipped,
    Incomplete,
    Done,
}
impl futures::Stream for PcapMessageProducer {
    type Item = Result<MessageStreamItem, DltParseError>;
    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context,
    ) -> futures::task::Poll<Option<Self::Item>> {
        let mut consumed = 0usize;
        let update_channel = self.update_channel.clone();
        let filter_config = self.filter_config.clone();
        let fibex = self.fibex_metadata.clone();
        let index = self.index;
        self.index += 1;
        let now = SystemTime::now();
        let since_the_epoch = now
            .duration_since(UNIX_EPOCH)
            .unwrap_or(std::time::Duration::from_secs(0));
        let mut last_in_ms = since_the_epoch.as_millis() as i64;
        let res = match self.reader.next() {
            Ok((offset, block)) => {
                // trace!("got new block (offset: {})", offset);
                consumed = offset;
                let data = match block {
                    PcapBlockOwned::NG(Block::EnhancedPacket(ref epb)) => {
                        let ts_us: i64 = (epb.ts_high as i64) << 32 | epb.ts_low as i64;
                        last_in_ms = ts_us / 1000;
                        Some(epb.data)
                    }
                    PcapBlockOwned::NG(Block::SimplePacket(ref spb)) => Some(spb.data),
                    PcapBlockOwned::NG(_) => None,
                    PcapBlockOwned::Legacy(_) | PcapBlockOwned::LegacyHeader(_) => None,
                };
                if let Some(payload) = data {
                    match SlicedPacket::from_ethernet(&payload) {
                        Err(value) => {
                            futures::task::Poll::Ready(Some(Err(DltParseError::ParsingHickup {
                                reason: format!(
                                    "error trying to extract data from ethernet frame: {}",
                                    value
                                ),
                            })))
                        }
                        Ok(value) => {
                            match dlt_message(
                                value.payload,
                                filter_config.as_ref(),
                                index,
                                Some(&update_channel),
                                fibex,
                                false,
                            ) {
                                Ok((_, ParsedMessage::Item(m))) => {
                                    let msg_with_storage_header = m.add_storage_header(Some(
                                        DltTimeStamp::from_ms(last_in_ms as u64),
                                    ));
                                    futures::task::Poll::Ready(Some(Ok(MessageStreamItem::Item(
                                        msg_with_storage_header,
                                    ))))
                                }
                                Ok((_, ParsedMessage::FilteredOut)) => {
                                    futures::task::Poll::Ready(Some(Ok(MessageStreamItem::Skipped)))
                                }
                                Ok((_, ParsedMessage::Invalid)) => {
                                    futures::task::Poll::Ready(Some(Ok(MessageStreamItem::Skipped)))
                                }
                                Err(nom::Err::Error(_e)) => futures::task::Poll::Ready(Some(Err(
                                    DltParseError::ParsingHickup {
                                        reason: format!("parsing dlt msg error: {:?}", _e),
                                    },
                                ))),
                                Err(nom::Err::Failure(_e)) => futures::task::Poll::Ready(Some(
                                    Err(DltParseError::Unrecoverable {
                                        cause: format!("parsing dlt msg failure: {:?}", _e),
                                    }),
                                )),

                                Err(nom::Err::Incomplete(n)) => {
                                    let needed = match n {
                                        nom::Needed::Size(s) => format!("{}", s),
                                        nom::Needed::Unknown => "unknown".to_string(),
                                    };
                                    futures::task::Poll::Ready(Some(Err(
                                        DltParseError::Unrecoverable {
                                            cause: format!(
                                                "read_one_dlt_message: imcomplete parsing error for dlt messages: (bytes left: {}, but needed: {})",
                                                value.payload.len(),
                                                needed)
                                        },
                                    )))
                                }
                            }
                        }
                    }
                } else {
                    futures::task::Poll::Pending
                }
            }
            Err(PcapError::Eof) => {
                trace!("Pcap: EOF");
                futures::task::Poll::Ready(Some(Ok(MessageStreamItem::Done)))
            }
            Err(PcapError::Incomplete) => {
                trace!("Pcap: Incomplete");
                let _ = self.reader.refill();
                futures::task::Poll::Ready(Some(Ok(MessageStreamItem::Incomplete)))
            }
            Err(e) => {
                warn!("Pcap: error {:?}", e);
                futures::task::Poll::Ready(Some(Err(DltParseError::Unrecoverable {
                    cause: format!("error reading pcap: {:?}", e),
                })))
            }
        };
        self.reader.consume(consumed);
        res
    }
}

#[allow(clippy::too_many_arguments)]
pub fn index_from_pcap<'a>(
    config: IndexingConfig<'a>,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    initial_line_nr: usize,
    update_channel: cc::Sender<ChunkResults>,
    shutdown_receiver: async_std::sync::Receiver<()>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
) -> Result<(), Error> {
    trace!("index_from_pcap for  conf: {:?}", config);
    let (out_file, current_out_file_size) = utils::get_out_file_and_size(true, config.out_path)?;
    // let out_file_name = format!("{:?}", out_file);
    let mut chunk_factory = ChunkFactory::new(config.chunk_size, current_out_file_size);
    let mut line_nr = initial_line_nr;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);

    let pcap_msg_producer = PcapMessageProducer::new(
        &config.in_file,
        update_channel.clone(),
        fibex_metadata,
        filter_config,
    )?;
    // listen for both a shutdown request and incomming messages
    // to do this we need to select over streams of the same type
    // the type we use to unify is this Event enum
    #[derive(Debug)]
    enum Event {
        Shutdown,
        Msg(Result<MessageStreamItem, DltParseError>),
    }
    let shutdown_stream = shutdown_receiver.map(|_| {
        debug!("shutdown_receiver event");
        Event::Shutdown
    });
    let message_stream = pcap_msg_producer.map(Event::Msg);
    let mut event_stream = futures::stream::select(message_stream, shutdown_stream);

    task::block_on(async {
        while let Some(event) = event_stream.next().await {
            // trace!("received event: {:?}", event);
            match event {
                Event::Shutdown => {
                    debug!("received shutdown through future channel");
                    let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                    break;
                }
                Event::Msg(Ok(MessageStreamItem::Item(msg))) => {
                    let written_bytes_len = utils::create_tagged_line_d(
                        config.tag,
                        &mut buf_writer,
                        &msg,
                        line_nr,
                        true,
                    )?;
                    line_nr += 1;
                    if let Some(chunk) =
                        chunk_factory.create_chunk_if_needed(line_nr, written_bytes_len)
                    {
                        // trace!("[line {}]: write to file {:?}", line_nr, out_file_name);
                        buf_writer.flush()?;
                        let _ = update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }));
                    }
                }
                Event::Msg(Ok(MessageStreamItem::Skipped)) => {
                    trace!("msg was skipped due to filters");
                }
                Event::Msg(Ok(MessageStreamItem::Incomplete)) => {
                    trace!("msg was incomplete");
                }
                Event::Msg(Ok(MessageStreamItem::Done)) => {
                    trace!("MessageStreamItem::Done received");
                    let _ = update_channel.send(Ok(IndexingProgress::Finished));
                    break;
                }
                Event::Msg(Err(DltParseError::ParsingHickup { reason })) => {
                    warn!("parsing hickup error in stream: {}", reason);
                    let _ = update_channel.send(Err(Notification {
                        severity: Severity::WARNING,
                        content: format!("parsing faild for one message: {}", reason),
                        line: None,
                    }));
                }
                Event::Msg(Err(DltParseError::Unrecoverable { cause })) => {
                    warn!("Unrecoverable error in stream: {}", cause);
                    let _ = update_channel.send(Ok(IndexingProgress::Finished));
                    break;
                }
            };
        }
        trace!("finished index_from_pcap()");
        Ok(())
    })
}

pub fn create_index_and_mapping_dlt_from_pcap<'a>(
    config: IndexingConfig<'a>,
    dlt_filter: Option<filtering::DltFilterConfig>,
    update_channel: &cc::Sender<ChunkResults>,
    shutdown_receiver: async_std::sync::Receiver<()>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
) -> Result<(), Error> {
    trace!("create_index_and_mapping_dlt");
    match utils::next_line_nr(config.out_path) {
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
                        content: content.clone(),
                        line: None,
                    }));
                    Err(err_msg(content))
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
                content: content.clone(),
                line: None,
            }));
            Err(err_msg(content))
        }
    }
}
