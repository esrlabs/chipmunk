use crate::producer::MessageProducer;
use crate::ByteSource;
use crate::Error as SourceError;
use crate::ReloadInfo;
use crate::SourceFilter;
use crate::TransportProtocol;
use crate::{LogMessage, MessageStreamItem, Parser};
use buf_redux::Buffer;
use crossbeam_channel as cc;
use indexer_base::{
    chunks::{ChunkFactory, ChunkResults, VoidResults},
    config::IndexingConfig,
    progress::*,
    utils,
};
use log::{debug, trace, warn};
use pcap_parser::{traits::PcapReaderIterator, PcapBlockOwned, PcapError, PcapNGReader};
use std::io::BufReader as IoBufReader;
use std::io::Read;
use std::time::SystemTime;
use std::time::UNIX_EPOCH;
use std::{
    fs::*,
    io::{BufWriter, Write},
};
use thiserror::Error;
use tokio_stream::{self as stream};
use tokio_util::sync::CancellationToken;

#[derive(Error, Debug)]
pub enum Error {
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
    #[error("Configuration wrong: {0}")]
    Configuration(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Unrecoverable parse error: {0}")]
    Unrecoverable(String),
}

pub struct PcapngByteSource<R: Read> {
    pcapng_reader: PcapNGReader<R>,
    buffer: Buffer,
    last_know_timestamp: Option<u64>,
}

fn current_ts() -> u64 {
    let now = SystemTime::now();
    let since_the_epoch = now
        .duration_since(UNIX_EPOCH)
        .unwrap_or_else(|_| std::time::Duration::from_secs(0));
    since_the_epoch.as_millis() as u64
}

impl<R: Read> PcapngByteSource<R> {
    pub fn new(reader: R) -> Result<Self, SourceError> {
        Ok(Self {
            pcapng_reader: PcapNGReader::new(65536, reader)
                .map_err(|e| SourceError::Setup(format!("{}", e)))?,
            buffer: Buffer::new(),
            last_know_timestamp: Some(current_ts()),
        })
    }
}

impl<R: Read> ByteSource for PcapngByteSource<R> {
    fn current_slice(&self) -> &[u8] {
        self.buffer.buf()
    }

    fn reload(&mut self, filter: Option<&SourceFilter>) -> Result<Option<ReloadInfo>, SourceError> {
        let maybe_data;
        let mut consumed;
        loop {
            match self.pcapng_reader.next() {
                Ok((bytes_read, block)) => {
                    trace!("PcapngByteSource::reload, bytes_read: {}", bytes_read);
                    consumed = bytes_read;
                    match block {
                        PcapBlockOwned::NG(pcap_parser::Block::EnhancedPacket(ref epb)) => {
                            trace!("Enhanced package");
                            let ts_us: u64 = (epb.ts_high as u64) << 32 | epb.ts_low as u64;
                            self.last_know_timestamp = Some(ts_us / 1000);
                            maybe_data = Some(epb.data);
                            break;
                        }
                        PcapBlockOwned::NG(pcap_parser::Block::SimplePacket(ref spb)) => {
                            trace!("SimplePacket");
                            maybe_data = Some(spb.data);
                            break;
                        }
                        other_type => {
                            debug_block(other_type);
                            self.pcapng_reader.consume(consumed);
                            continue;
                        }
                    }
                }
                Err(PcapError::Eof) => {
                    trace!("reloading from pcap file, EOF");
                    return Ok(None);
                }
                Err(PcapError::Incomplete) => {
                    trace!("reloading from pcap file, Incomplete");
                    self.pcapng_reader
                        .refill()
                        .expect("refill pcapng reader failed");
                    continue;
                }
                Err(e) => {
                    let m = format!("{}", e);
                    trace!("reloading from pcap file, {}", m);
                    return Err(SourceError::Unrecoverable(m));
                }
            }
        }
        let res = match maybe_data {
            Some(payload) => match etherparse::SlicedPacket::from_ethernet(payload) {
                Ok(value) => match (value.transport, filter) {
                    (
                        Some(actual),
                        Some(SourceFilter {
                            transport: Some(wanted),
                        }),
                    ) => {
                        let actual_tp: TransportProtocol = actual.into();
                        if actual_tp == *wanted {
                            Ok(Some(ReloadInfo::new(
                                self.buffer.copy_from_slice(value.payload),
                                self.last_know_timestamp,
                            )))
                        } else {
                            Ok(Some(ReloadInfo::new(0, self.last_know_timestamp)))
                        }
                    }
                    _ => Ok(Some(ReloadInfo::new(
                        self.buffer.copy_from_slice(value.payload),
                        self.last_know_timestamp,
                    ))),
                },
                Err(e) => Err(SourceError::Unrecoverable(format!(
                    "error trying to extract data from ethernet frame: {}",
                    e
                ))),
            },
            None => Ok(Some(ReloadInfo::new(0, self.last_know_timestamp))),
        };
        // bytes are copied into buffer and can be dropped by pcap reader
        trace!("consume {} processed bytes", consumed);
        self.pcapng_reader.consume(consumed);
        res
    }

    fn consume(&mut self, offset: usize) {
        trace!(
            "ByteSource::consume before: len {} bytes",
            self.buffer.len(),
        );
        self.buffer.consume(offset);
        trace!("ByteSource::consume after: len {} bytes", self.buffer.len(),);
    }

    fn len(&self) -> usize {
        self.buffer.len()
    }
}

fn debug_block(b: PcapBlockOwned) {
    match b {
        PcapBlockOwned::NG(pcap_parser::Block::SectionHeader(_)) => {
            trace!("NG SectionHeader");
        }
        PcapBlockOwned::NG(pcap_parser::Block::InterfaceDescription(_)) => {
            trace!("NG InterfaceDescription");
        }
        PcapBlockOwned::NG(pcap_parser::Block::NameResolution(h)) => {
            trace!("NG NameResolution: {} namerecords", h.nr.len());
        }
        PcapBlockOwned::NG(pcap_parser::Block::InterfaceStatistics(h)) => {
            trace!("NG InterfaceStatistics: {:?}", h.options);
        }
        PcapBlockOwned::NG(pcap_parser::Block::SystemdJournalExport(_h)) => {
            trace!("NG SystemdJournalExport");
        }
        PcapBlockOwned::NG(pcap_parser::Block::DecryptionSecrets(_h)) => {
            trace!("NG DecryptionSecrets");
        }
        PcapBlockOwned::NG(pcap_parser::Block::Custom(_)) => {
            trace!("NG Custom");
        }
        PcapBlockOwned::NG(pcap_parser::Block::Unknown(_)) => {
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

/// extract log messages from a PCAPNG file
#[allow(clippy::too_many_arguments)]
pub async fn convert_from_pcapng<T: LogMessage, P: Parser<T> + Unpin>(
    pcap_path: &std::path::Path,
    out_path: &std::path::Path,
    update_channel: cc::Sender<VoidResults>,
    cancel: CancellationToken,
    parser: P,
) -> Result<(), Error> {
    trace!("Starting convert_from_pcapng");

    let pcap_file_size = pcap_path.metadata()?.len();
    let progress = |consumed: usize| {
        let _ = update_channel.send(Ok(IndexingProgress::Progress {
            ticks: (consumed as u64, pcap_file_size),
        }));
    };
    let (out_file, _current_out_file_size) = utils::get_out_file_and_size(false, out_path)
        .map_err(|e| Error::Unrecoverable(format!("{}", e)))?;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
    let pcap_file = File::open(&pcap_path)?;
    let buf_reader = IoBufReader::new(&pcap_file);
    let pcapng_byte_src =
        PcapngByteSource::new(buf_reader).map_err(|e| Error::Unrecoverable(format!("{}", e)))?;
    let pcap_msg_producer = MessageProducer::new(parser, pcapng_byte_src);
    // listen for both a shutdown request and incomming messages
    // to do this we need to select over streams of the same type
    // the type we use to unify is this Event enum

    let mut processed_bytes = 0usize;
    let incomplete_parses = 0usize;
    let mut stopped = false;
    let mut msg_stream = stream::iter(pcap_msg_producer);

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                    warn!("received shutdown through future channel");
                    let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                    stopped = true;
                    break;
            }
            item = tokio_stream::StreamExt::next(&mut msg_stream) => {
                match item {
                    Some((consumed, msg)) => {
                        match msg {
                            MessageStreamItem::Item(msg) => {
                                trace!("convert_from_pcapng: Received msg event");
                                if consumed > 0 {
                                    processed_bytes += consumed;
                                    progress(processed_bytes);
                                }
                                buf_writer.write_all(&msg.as_stored_bytes())?;
                            }
                            MessageStreamItem::Skipped => {
                                trace!("convert_from_pcapng: Msg was skipped due to filters");
                            }
                            MessageStreamItem::Empty => {
                                trace!("convert_from_pcapng: pcap frame did not contain a message");
                            }
                            MessageStreamItem::Incomplete => {
                                trace!(
                                    "convert_from_pcapng Msg was incomplete (consumed {} bytes)",
                                    consumed
                                );
                            }
                            MessageStreamItem::Done => {
                                trace!("convert_from_pcapng: MessageStreamItem::Done received");
                                let _ = update_channel.send(Ok(IndexingProgress::Finished));
                                break;
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
      // TODO maybe not needed anymore
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

#[allow(clippy::too_many_arguments)]
pub async fn index_from_message_stream<T, I>(
    config: IndexingConfig,
    initial_line_nr: usize,
    update_channel: cc::Sender<ChunkResults>,
    cancel: CancellationToken,
    pcap_msg_producer: I,
) -> Result<(), Error>
where
    T: LogMessage,
    I: Iterator<Item = (usize, MessageStreamItem<T>)>,
{
    trace!("index_from_message_stream for  conf: {:?}", config);
    let (out_file, current_out_file_size) =
        utils::get_out_file_and_size(config.append, &config.out_path)
            .map_err(|e| Error::Unrecoverable(format!("{}", e)))?;
    let mut chunk_factory = ChunkFactory::new(config.chunk_size, current_out_file_size);
    let mut line_nr = initial_line_nr;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
    let pcap_file_size = config.in_file.metadata().map(|md| md.len())?;
    let progress = |consumed: usize| {
        let _ = update_channel.send(Ok(IndexingProgress::Progress {
            ticks: (consumed as u64, pcap_file_size),
        }));
    };

    let mut msg_stream = stream::iter(pcap_msg_producer);
    // listen for both a shutdown request and incomming messages
    // to do this we need to select over streams of the same type
    // the type we use to unify is this Event enum

    let mut chunk_count = 0usize;

    let mut processed_bytes = 0usize;
    let incomplete_parses = 0usize;
    let mut stopped = false;

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                    debug!("received shutdown through future channel");
                    stopped = true;
                    let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                    break;
            }
            item = tokio_stream::StreamExt::next(&mut msg_stream) => {
                match item {
                    Some((consumed, msg)) => {
                        if consumed > 0 {
                            processed_bytes += consumed;
                            progress(processed_bytes);
                        }
                        match msg {
                            MessageStreamItem::Item(msg) => {
                                trace!("received msg event");

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
                            MessageStreamItem::Skipped => {
                                trace!("msg was skipped due to filters");
                            }
                            MessageStreamItem::Empty => {
                                trace!("convert_from_pcapng: pcap frame did not contain a message");
                            }
                            MessageStreamItem::Incomplete => {
                                trace!("msg was incomplete");
                            }
                            MessageStreamItem::Done => {
                                trace!("MessageStreamItem::Done received");
                                buf_writer.flush()?;
                                if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunk_count == 0)
                                {
                                    trace!("index: add last chunk {:?}", chunk);
                                    let _ = update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }));
                                }
                                break;
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

    // TODO maybe not needed anymore
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

pub async fn create_index_and_mapping_from_pcapng<
    T: LogMessage,
    P: Parser<T> + Unpin,
    S: ByteSource,
>(
    config: IndexingConfig,
    update_channel: &cc::Sender<ChunkResults>,
    cancel: CancellationToken,
    parser: P,
    source: S,
) -> Result<(), Error> {
    trace!("create_index_and_mapping_from_pcapng");
    match utils::next_line_nr(&config.out_path) {
        Ok(initial_line_nr) => {
            let pcap_msg_producer = MessageProducer::new(parser, source);
            match index_from_message_stream(
                config,
                initial_line_nr,
                update_channel.clone(),
                cancel,
                pcap_msg_producer,
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
            Err(Error::Unrecoverable(format!("{}", e)))
        }
    }
}
