use crate::{
    producer::MessageProducer, ByteSource, Error as SourceError, ReloadInfo, SourceFilter,
    TransportProtocol,
};
use async_trait::async_trait;
use buf_redux::Buffer;
use futures::pin_mut;
use indexer_base::{progress::*, utils};
use log::{debug, error, trace, warn};
use parsers::{LogMessage, MessageStreamItem, ParseYield, Parser};
use pcap_parser::{traits::PcapReaderIterator, PcapBlockOwned, PcapError, PcapNGReader};
use std::{
    fs::*,
    io::{BufWriter, Read, Seek, Write},
    path::Path,
};
use thiserror::Error;
use tokio::sync::mpsc::Sender;
use tokio_stream::Stream;
use tokio_util::sync::CancellationToken;

pub type VoidResults = std::result::Result<IndexingProgress<()>, Notification>;
const PROGRESS_PARTS: u64 = 20;

#[derive(Error, Debug)]
pub enum Error {
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
    #[error("Unrecoverable parse error: {0}")]
    Unrecoverable(String),
}

pub struct PcapngByteSource<R: Read + Seek> {
    pcapng_reader: PcapNGReader<R>,
    buffer: Buffer,
    last_know_timestamp: Option<u64>,
    total: usize,
}

impl<R: Read + Seek> PcapngByteSource<R> {
    pub fn new(reader: R) -> Result<Self, SourceError> {
        Ok(Self {
            pcapng_reader: PcapNGReader::new(65536, reader)
                .map_err(|e| SourceError::Setup(format!("{e}")))?,
            buffer: Buffer::new(),
            last_know_timestamp: None,
            total: 0,
        })
    }
}

#[async_trait]
impl<R: Read + Send + Sync + Seek> ByteSource for PcapngByteSource<R> {
    async fn reload(
        &mut self,
        filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        let raw_data;
        let mut consumed;
        let mut skipped = 0usize;
        loop {
            match self.pcapng_reader.next() {
                Ok((bytes_read, block)) => {
                    self.total += bytes_read;
                    trace!(
                        "PcapngByteSource::reload, bytes_read: {} (total: {})",
                        bytes_read,
                        self.total
                    );
                    consumed = bytes_read;
                    match block {
                        PcapBlockOwned::NG(pcap_parser::Block::EnhancedPacket(ref epb)) => {
                            trace!("Enhanced package");
                            let ts_us: u64 = (epb.ts_high as u64) << 32 | epb.ts_low as u64;
                            self.last_know_timestamp = Some(ts_us / 1000);
                            raw_data = epb.data;
                            break;
                        }
                        PcapBlockOwned::NG(pcap_parser::Block::SimplePacket(ref spb)) => {
                            trace!("SimplePacket");
                            raw_data = spb.data;
                            break;
                        }
                        other_type => {
                            debug_block(other_type);
                            skipped += consumed;
                            debug!("skipped in total {} bytes", skipped);
                            self.pcapng_reader.consume(consumed);
                            continue;
                        }
                    }
                }
                Err(PcapError::Eof) => {
                    debug!("reloading from pcap file, EOF");
                    return Ok(None);
                }
                Err(PcapError::Incomplete) => {
                    trace!("reloading from pcap file, Incomplete");
                    self.pcapng_reader
                        .refill()
                        .expect("refill pcapng reader failed");
                    // continue;
                }
                Err(e) => {
                    let m = format!("{e}");
                    error!("reloading from pcap file, {}", m);
                    return Err(SourceError::Unrecoverable(m));
                }
            }
        }
        let res = match etherparse::SlicedPacket::from_ethernet(raw_data) {
            Ok(value) => {
                skipped += consumed - value.payload.len();
                match (value.transport, filter) {
                    (
                        Some(actual),
                        Some(SourceFilter {
                            transport: Some(wanted),
                        }),
                    ) => {
                        let actual_tp: TransportProtocol = actual.into();
                        let received_bytes = self.buffer.copy_from_slice(value.payload);
                        if actual_tp == *wanted {
                            Ok(Some(ReloadInfo::new(
                                received_bytes,
                                received_bytes,
                                skipped,
                                self.last_know_timestamp,
                            )))
                        } else {
                            Ok(Some(ReloadInfo::new(
                                0,
                                0,
                                value.payload.len() + skipped,
                                self.last_know_timestamp,
                            )))
                        }
                    }
                    _ => {
                        let copied = self.buffer.copy_from_slice(value.payload);
                        Ok(Some(ReloadInfo::new(
                            copied,
                            copied,
                            skipped,
                            self.last_know_timestamp,
                        )))
                    }
                }
            }
            Err(e) => Err(SourceError::Unrecoverable(format!(
                "error trying to extract data from ethernet frame: {e}"
            ))),
        };
        // bytes are copied into buffer and can be dropped by pcap reader
        trace!("consume {} processed bytes", consumed);
        self.pcapng_reader.consume(consumed);
        res
    }

    fn current_slice(&self) -> &[u8] {
        self.buffer.buf()
    }

    fn consume(&mut self, offset: usize) {
        self.buffer.consume(offset);
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

pub enum OutputProgress {
    /// Progress indicates how many ticks of the total amount have been processed
    /// the first number indicates the actual amount, the second the presumed total
    Progress {
        ticks: (u64, u64),
    },
    Stopped,
    Finished,
}

#[async_trait]
pub trait Output {
    async fn consume_msg<T>(&mut self, msg: T) -> Result<(), Error>
    where
        T: LogMessage + Send;

    async fn done(&mut self) -> Result<(), Error>;

    async fn progress(&mut self, progress: Result<OutputProgress, Notification>);
}

struct TextFileOutput {
    buf_writer: BufWriter<File>,
    update_channel: Sender<VoidResults>,
}

impl TextFileOutput {
    pub fn new(out_path: &Path, update_channel: Sender<VoidResults>) -> Result<Self, Error> {
        let (out_file, _current_out_file_size) = utils::get_out_file_and_size(false, out_path)
            .map_err(|e| Error::Unrecoverable(format!("{e}")))?;
        let buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
        Ok(Self {
            buf_writer,
            update_channel,
        })
    }
}

#[async_trait]
impl Output for TextFileOutput {
    async fn consume_msg<T>(&mut self, msg: T) -> Result<(), Error>
    where
        T: LogMessage + Send,
    {
        let text = format!("{msg}\n");
        self.buf_writer.write_all(text.as_bytes())?;

        Ok(())
    }

    async fn done(&mut self) -> Result<(), Error> {
        self.buf_writer.flush()?;
        Ok(())
    }

    async fn progress(&mut self, progress: Result<OutputProgress, Notification>) {
        self.update_channel
            .send(match progress {
                Ok(OutputProgress::Progress { ticks }) => Ok(IndexingProgress::Progress { ticks }),
                Ok(OutputProgress::Stopped) => Ok(IndexingProgress::Stopped),
                Ok(OutputProgress::Finished) => Ok(IndexingProgress::Finished),
                Err(notification) => Err(notification),
            })
            .await
            .expect("Could not use update channel");
    }
}

struct DltFileOutput {
    buf_writer: BufWriter<File>,
    update_channel: Sender<VoidResults>,
}

impl DltFileOutput {
    pub fn new(out_path: &Path, update_channel: Sender<VoidResults>) -> Result<Self, Error> {
        let (out_file, _current_out_file_size) = utils::get_out_file_and_size(false, out_path)
            .map_err(|e| Error::Unrecoverable(format!("{e}")))?;
        let buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
        Ok(Self {
            buf_writer,
            update_channel,
        })
    }
}

#[async_trait]
impl Output for DltFileOutput {
    async fn consume_msg<T>(&mut self, msg: T) -> Result<(), Error>
    where
        T: LogMessage + Send,
    {
        msg.to_writer(&mut self.buf_writer)?;
        Ok(())
    }

    async fn done(&mut self) -> Result<(), Error> {
        self.buf_writer.flush()?;
        Ok(())
    }

    async fn progress(&mut self, progress: Result<OutputProgress, Notification>) {
        self.update_channel
            .send(match progress {
                Ok(OutputProgress::Progress { ticks }) => Ok(IndexingProgress::Progress { ticks }),
                Ok(OutputProgress::Stopped) => Ok(IndexingProgress::Stopped),
                Ok(OutputProgress::Finished) => Ok(IndexingProgress::Finished),
                Err(notification) => Err(notification),
            })
            .await
            .expect("Could not use update channel");
    }
}

/// print log messages from a PCAPNG file
pub async fn print_from_pcapng<T: LogMessage + std::marker::Unpin + Send, P: Parser<T> + Unpin>(
    pcap_path: &std::path::Path,
    out_path: &std::path::Path,
    update_channel: Sender<VoidResults>,
    cancel: CancellationToken,
    parser: P,
) -> Result<(), Error> {
    let total = pcap_path.metadata()?.len();
    debug!("Starting convert_from_pcapng with {} bytes", total);
    let output = TextFileOutput::new(out_path, update_channel)?;

    let pcap_file = File::open(pcap_path)?;
    let buf_reader = std::io::BufReader::new(&pcap_file);
    let pcapng_byte_src =
        PcapngByteSource::new(buf_reader).map_err(|e| Error::Unrecoverable(format!("{e}")))?;
    let mut pcap_msg_producer = MessageProducer::new(parser, pcapng_byte_src, None);
    let msg_stream = pcap_msg_producer.as_stream();
    pin_mut!(msg_stream);
    index_from_message_stream(total, cancel, msg_stream, output).await
}

/// extract log messages from a PCAPNG file
pub async fn convert_from_pcapng<
    T: LogMessage + std::marker::Unpin + Send,
    P: Parser<T> + Unpin,
>(
    pcap_path: &std::path::Path,
    out_path: &std::path::Path,
    update_channel: Sender<VoidResults>,
    cancel: CancellationToken,
    parser: P,
) -> Result<(), Error> {
    let total = pcap_path.metadata()?.len();
    debug!("Starting convert_from_pcapng with {} bytes", total);
    let output = DltFileOutput::new(out_path, update_channel)?;

    let pcap_file = File::open(pcap_path)?;
    let buf_reader = std::io::BufReader::new(&pcap_file);
    let pcapng_byte_src =
        PcapngByteSource::new(buf_reader).map_err(|e| Error::Unrecoverable(format!("{e}")))?;
    let mut pcap_msg_producer = MessageProducer::new(parser, pcapng_byte_src, None);
    let msg_stream = pcap_msg_producer.as_stream();
    pin_mut!(msg_stream);
    index_from_message_stream(total, cancel, msg_stream, output).await
}

async fn index_from_message_stream<T, S, O>(
    total: u64,
    cancel: CancellationToken,
    mut pcap_msg_producer: S,
    mut output: O,
) -> Result<(), Error>
where
    T: LogMessage + Send,
    S: Stream<Item = (usize, MessageStreamItem<T>)> + std::marker::Unpin,
    O: Output,
{
    let mut processed_bytes = 0usize;
    let incomplete_parses = 0usize;
    let mut stopped = false;

    let fraction = (total / PROGRESS_PARTS) as usize;
    let mut index = 0usize;

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                    debug!("received shutdown through future channel");
                    stopped = true;
                    output.progress(Ok(OutputProgress::Stopped)).await;
                    // update_channel.send(Ok(IndexingProgress::Stopped))
                    //     .await
                    //     .expect("UpdateChannel closed");
                    break;
            }
            item = tokio_stream::StreamExt::next(&mut pcap_msg_producer) => {
                match item {
                    Some((consumed, msg)) => {
                        if consumed > 0 {
                            processed_bytes += consumed;
                            let new_index = processed_bytes/fraction;
                            if index != new_index {
                                index = new_index;
                                output.progress(Ok(OutputProgress::Progress {
                                        ticks: (processed_bytes as u64, total),
                                    })).await;
                            }
                        }
                        match msg {
                            MessageStreamItem::Item(ParseYield::Message(msg)) => {
                                trace!("received msg event");
                                output.consume_msg(msg).await?;
                            }
                            MessageStreamItem::Item(ParseYield::MessageAndAttachment((msg, _attachment))) => {
                                trace!("received msg event AND attachment");
                                output.consume_msg(msg).await?;
                                // TODO @kevin: use attachment
                            }
                            MessageStreamItem::Item(ParseYield::Attachment(_attachment)) => {
                                trace!("received attachment event");
                                // TODO @kevin: use attachment
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
                                output.done().await?;
                                // buf_writer.flush()?;
                                // if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunk_count == 0)
                                // {
                                //     trace!("index: add last chunk {:?}", chunk);
                                //     update_channel.send(Ok(IndexingProgress::GotItem { item: chunk })).await.expect("UpdateChannel closed");
                                // }
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
        output
            .progress(Err(Notification {
                severity: Severity::WARNING,
                content: format!("parsing incomplete for {incomplete_parses} messages"),
                line: None,
            }))
            .await;
    }
    output
        .progress(Ok(if stopped {
            OutputProgress::Stopped
        } else {
            OutputProgress::Finished
        }))
        .await;
    Ok(())
}
