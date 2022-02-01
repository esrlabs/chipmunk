extern crate dirs;
use bytes::BytesMut;
use crossbeam_channel as cc;
use dlt_core::{
    dlt::*,
    fibex::{gather_fibex_data, FibexConfig, FibexMetadata},
    filtering,
    parse::{dlt_message, *},
};
use indexer_base::{
    chunks::{Chunk, ChunkFactory, ChunkResults},
    config::SocketConfig,
    progress::*,
    utils,
};
use parsers::dlt::fmt::FormattableMessage;
use std::{
    io::{BufWriter, Write},
    net::{IpAddr, Ipv4Addr, SocketAddr},
    path::{Path, PathBuf},
};
use thiserror::Error;
use tokio_stream::{wrappers::ReceiverStream, StreamExt};
use tokio_util::{
    codec::{Decoder, Framed},
    udp::UdpFramed,
};

#[derive(Debug, Error)]
pub enum ConnectionError {
    #[error("socket configuration seems to be broken: {}", cause)]
    WrongConfiguration { cause: String },
    #[error("could not establish a connection: {}", reason)]
    UnableToConnect { reason: String },
    #[error("could establish session file: {}", error)]
    UnableGetSessionFile { error: String },
    #[error("error trying to connect: {}", info)]
    Other { info: String },
}

impl From<std::io::Error> for ConnectionError {
    fn from(err: std::io::Error) -> ConnectionError {
        ConnectionError::Other {
            info: format!("{}", err),
        }
    }
}

impl From<std::net::AddrParseError> for ConnectionError {
    fn from(err: std::net::AddrParseError) -> ConnectionError {
        ConnectionError::WrongConfiguration {
            cause: format!("{}", err),
        }
    }
}

impl From<std::num::ParseIntError> for ConnectionError {
    fn from(err: std::num::ParseIntError) -> ConnectionError {
        ConnectionError::WrongConfiguration {
            cause: format!("{}", err),
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn index_from_socket(
    session_id: String,
    socket_config: SocketConfig,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    update_channel: cc::Sender<ChunkResults>,
    fibex: Option<FibexConfig>,
    tag: &str,
    out_path: &Path,
    initial_line_nr: usize,
    shutdown_receiver: tokio::sync::mpsc::Receiver<()>,
) -> Result<(), ConnectionError> {
    debug!("index_from_socket: with socket conf: {:?}", socket_config);
    let bind_addr_and_port: SocketAddr = match socket_config.socket_addr() {
        Ok(addr) => addr,
        Err(e) => {
            return Err(ConnectionError::WrongConfiguration {
                cause: format!("{}", e),
            });
        }
    };
    debug!("Binding socket within: {}", bind_addr_and_port);
    let fibex_metadata: Option<FibexMetadata> = fibex.and_then(gather_fibex_data);
    match socket_config.udp_connection_info {
        None => {
            index_from_socket_tcp(
                session_id,
                bind_addr_and_port,
                socket_config,
                filter_config,
                update_channel,
                fibex_metadata,
                tag,
                out_path,
                initial_line_nr,
                shutdown_receiver,
            )
            .await
        }
        Some(_) => {
            index_from_socket_udp(
                session_id,
                bind_addr_and_port,
                socket_config,
                filter_config,
                update_channel,
                fibex_metadata,
                tag,
                out_path,
                initial_line_nr,
                shutdown_receiver,
            )
            .await
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub async fn index_from_socket_udp(
    session_id: String,
    addr: SocketAddr,
    socket_config: SocketConfig,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    update_channel: cc::Sender<ChunkResults>,
    fibex_metadata: Option<FibexMetadata>,
    tag: &str,
    out_path: &Path,
    initial_line_nr: usize,
    shutdown_receiver: tokio::sync::mpsc::Receiver<()>,
) -> Result<(), ConnectionError> {
    let mut processor = SessionProcessor::new(
        session_id.clone(),
        out_path,
        initial_line_nr,
        tag,
        update_channel.clone(),
    )?;
    let socket = tokio::net::UdpSocket::bind(addr).await.map_err(|e| {
        warn!("Error trying to bind to {}: {}", addr, e);
        ConnectionError::Other {
            info: format!(
                "You cannot not bind a UDP socket to {}",
                socket_config.bind_addr
            ),
        }
    })?;
    for multicast_info in &socket_config
        .udp_connection_info
        .map_or_else(Vec::new, |i| i.multicast_addr)
    {
        let multi_addr =
            multicast_info
                .multicast_addr()
                .map_err(|e| ConnectionError::WrongConfiguration {
                    cause: format!("{}", e),
                })?;
        match multi_addr {
            IpAddr::V4(addr) => {
                let inter: Ipv4Addr = match multicast_info.interface.as_ref() {
                    Some(s) => s.parse()?,
                    None => Ipv4Addr::new(0, 0, 0, 0),
                };
                if let Err(e) = socket.join_multicast_v4(addr, inter) {
                    let msg = format!("error joining multicast group: {}", e);
                    warn!("{}", msg);
                    return Err(ConnectionError::UnableToConnect { reason: msg });
                }
                debug!(
                    "Joining UDP multicast group: socket.join_multicast_v4({}, {})",
                    addr, inter
                );
            }
            IpAddr::V6(addr) => {
                let inter: u32 = match multicast_info.interface.as_ref() {
                    Some(s) => s.parse::<u32>()?,
                    None => 0,
                };
                if let Err(e) = socket.join_multicast_v6(&addr, inter) {
                    let msg = format!("error joining multicast group: {}", e);
                    warn!("{}", msg);
                    return Err(ConnectionError::UnableToConnect { reason: msg });
                }
            }
        };
    }
    // send (0,0),(0,0) to indicate connection established
    let _ = update_channel.send(Ok(IndexingProgress::GotItem {
        item: Chunk {
            r: (0, 0),
            b: (0, 0),
        },
    }));
    let mut message_stream = UdpFramed::new(
        socket,
        DltMessageDecoder {
            filter_config,
            fibex_metadata,
        },
    );

    let mut shutdown_stream = ReceiverStream::new(shutdown_receiver);

    // listen for both a shutdown request and incomming messages
    // to do this we need to select over streams of the same type
    // the type we use to unify is this Event enum
    loop {
        tokio::select! {
            _ = shutdown_stream.next() => {
                    debug!("Received shutdown in index_from_socket_udp");
                    let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                    break;
            }
            Some(msg) = message_stream.next() => {
                match msg {
                    Ok((dlt_event, _)) => processor.event(dlt_event, message_stream.codec().fibex())?,
                    Err(DltParseError::ParsingHickup ( reason )) => processor.error(reason),
                    Err(e) => {
                        warn!("Unexpected error in message stream: {}", e);
                        break;
                    }
                }
            }
            else => break,
        }
    }
    processor.close()?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub async fn index_from_socket_tcp(
    session_id: String,
    addr: SocketAddr,
    socket_config: SocketConfig,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    update_channel: cc::Sender<ChunkResults>,
    fibex_metadata: Option<FibexMetadata>,
    tag: &str,
    out_path: &Path,
    initial_line_nr: usize,
    shutdown_receiver: tokio::sync::mpsc::Receiver<()>,
) -> Result<(), ConnectionError> {
    let mut processor = SessionProcessor::new(
        session_id.clone(),
        out_path,
        initial_line_nr,
        tag,
        update_channel.clone(),
    )?;
    let socket = tokio::net::TcpStream::connect(addr).await.map_err(|e| {
        warn!("Error trying to connect to {}: {}", addr, e);
        ConnectionError::Other {
            info: format!(
                "You cannot connect to TCP socket {}",
                socket_config.bind_addr
            ),
        }
    })?;
    // send (0,0),(0,0) to indicate connection established
    let _ = update_channel.send(Ok(IndexingProgress::GotItem {
        item: Chunk {
            r: (0, 0),
            b: (0, 0),
        },
    }));
    let mut message_stream = Framed::new(
        socket,
        DltMessageDecoder {
            filter_config,
            fibex_metadata,
        },
    );
    let mut shutdown_stream = ReceiverStream::new(shutdown_receiver);

    // listen for both a shutdown request and incomming messages
    // to do this we need to select over streams of the same type
    // the type we use to unify is this Event enum
    loop {
        tokio::select! {
            _ = shutdown_stream.next() => {
                    debug!("Received shutdown in index_from_socket_tcp");
                    let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                    break;
            }
            Some(msg) = message_stream.next() => {
                match msg {
                    Ok(dlt_event) => processor.event(dlt_event, message_stream.codec().fibex())?,
                    Err(DltParseError::ParsingHickup ( reason )) => processor.error(reason),
                    Err(e) => {
                        warn!("Unexpected error in message stream: {}", e);
                        break;
                    }
                }
            }
            else => break,
        }
    }

    processor.close()?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub async fn create_index_and_mapping_dlt_from_socket(
    session_id: String,
    socket_config: SocketConfig,
    tag: &str,
    out_path: &Path,
    dlt_filter: Option<filtering::DltFilterConfig>,
    update_channel: &cc::Sender<ChunkResults>,
    shutdown_receiver: tokio::sync::mpsc::Receiver<()>,
    fibex: Option<FibexConfig>,
) -> Result<(), ConnectionError> {
    debug!("create_index_and_mapping_dlt_from_socket");
    let res = match utils::next_line_nr(out_path) {
        Ok(initial_line_nr) => {
            let filter_config: Option<filtering::ProcessedDltFilterConfig> =
                dlt_filter.map(filtering::process_filter_config);
            match index_from_socket(
                session_id,
                socket_config,
                filter_config,
                update_channel.clone(),
                fibex,
                tag,
                out_path,
                initial_line_nr,
                shutdown_receiver,
            )
            .await
            {
                Err(e) => {
                    let _ = update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content: format!("{}", e),
                        line: None,
                    }));
                    Err(e)
                }
                Ok(_) => Ok(()),
            }
        }
        Err(e) => {
            let content = format!(
                "Could not determine last line number of {:?} ({})",
                out_path, e
            );
            let _ = update_channel.send(Err(Notification {
                severity: Severity::ERROR,
                content: content.clone(),
                line: None,
            }));
            Err(ConnectionError::Other { info: content })
        }
    };
    let _ = update_channel.send(Ok(IndexingProgress::Finished));
    res
}

pub(crate) struct SessionProcessor {
    tmp_writer: BufWriter<std::fs::File>,
    chunk_factory: ChunkFactory,
    buf_writer: BufWriter<std::fs::File>,
    line_nr: usize,
    tag: String,
    update_channel: cc::Sender<ChunkResults>,
}

pub(crate) fn session_file_path(session_id: &str) -> Option<PathBuf> {
    let home_dir = dirs::home_dir()?;
    let tmp_file_name = format!("{}.dlt", session_id);
    Some(
        home_dir
            .join(".chipmunk")
            .join("streams")
            .join(tmp_file_name),
    )
}

pub(crate) fn create_dlt_session_file(session_id: &str) -> Option<std::fs::File> {
    let path = session_file_path(session_id)?;
    std::fs::File::create(path).ok()
}

impl SessionProcessor {
    fn new(
        session_id: String,
        out_path: &Path,
        initial_line_nr: usize,
        tag: &str,
        update_channel: cc::Sender<ChunkResults>,
    ) -> Result<Self, ConnectionError> {
        let (out_file, current_out_file_size) = match utils::get_out_file_and_size(true, out_path) {
            Ok((out_file, current_out_file_size)) => (out_file, current_out_file_size),
            Err(e) => {
                return Err(ConnectionError::UnableGetSessionFile {
                    error: e.to_string(),
                })
            }
        };
        let tmp_dlt_file =
            create_dlt_session_file(&session_id).ok_or(ConnectionError::WrongConfiguration {
                cause: "Could not create dlt session file".to_owned(),
            })?;
        Ok(SessionProcessor {
            tmp_writer: BufWriter::new(tmp_dlt_file),
            chunk_factory: ChunkFactory::new(0, current_out_file_size),
            buf_writer: BufWriter::with_capacity(10 * 1024 * 1024, out_file),
            line_nr: initial_line_nr,
            tag: tag.to_owned(),
            update_channel,
        })
    }

    pub fn event(
        &mut self,
        event: DltEvent,
        fibex_metadata: Option<&FibexMetadata>,
    ) -> Result<(), ConnectionError> {
        match event {
            DltEvent::Messages(msgs) => {
                for m in msgs {
                    self.tmp_writer.write_all(&m.as_bytes())?;
                    let formattable_msg = FormattableMessage {
                        message: m,
                        fibex_metadata,
                        options: None,
                    };
                    let written_bytes_len = utils::create_tagged_line_d(
                        &self.tag,
                        &mut self.buf_writer,
                        &formattable_msg,
                        self.line_nr,
                        true,
                    )?;
                    self.line_nr += 1;
                    if let Some(chunk) = self
                        .chunk_factory
                        .add_bytes(self.line_nr, written_bytes_len)
                    {
                        self.buf_writer.flush()?;
                        let _ = self
                            .update_channel
                            .send(Ok(IndexingProgress::GotItem { item: chunk }));
                    }
                }
            }
            DltEvent::Progress(p) => match p {
                Progress::Notification(n) => {
                    let _ = self.update_channel.send(Err(n));
                }
                Progress::Ticks(Ticks { count, total }) => {
                    let _ = self.update_channel.send(Ok(IndexingProgress::Progress {
                        ticks: (count, total),
                    }));
                }
                Progress::Stopped => {
                    let _ = self.update_channel.send(Ok(IndexingProgress::Stopped));
                }
            },
        }
        Ok(())
    }

    pub fn error(&self, reason: String) {
        debug!("parsing hickup: {}", reason);
        let _ = self.update_channel.send(Err(Notification {
            severity: Severity::WARNING,
            content: format!("parsing faild for one message: {}", reason),
            line: None,
        }));
    }

    pub fn close(&mut self) -> Result<(), std::io::Error> {
        self.tmp_writer.flush()
    }
}
pub(crate) struct DltMessageDecoder {
    pub(crate) filter_config: Option<filtering::ProcessedDltFilterConfig>,
    pub(crate) fibex_metadata: Option<FibexMetadata>,
}

impl DltMessageDecoder {
    fn fibex(&self) -> Option<&FibexMetadata> {
        self.fibex_metadata.as_ref()
    }
}

#[derive(Debug)]
pub enum DltEvent {
    Messages(Vec<Message>),
    Progress(Progress),
}

impl Decoder for DltMessageDecoder {
    type Item = DltEvent;
    type Error = DltParseError;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        let received_bytes = src.len();
        let buf = src.split_to(received_bytes);
        let mut messages: Vec<Message> = vec![];
        let mut consumed = 0usize;
        loop {
            match dlt_message(&buf[consumed..], self.filter_config.as_ref(), false) {
                Ok((_, ParsedMessage::Invalid)) => {
                    warn!("invalid message received");
                    if !messages.is_empty() {
                        return Ok(Some(DltEvent::Messages(messages)));
                    } else {
                        return Ok(None);
                    }
                }
                Ok((_, ParsedMessage::FilteredOut(n))) => {
                    // one message of n bytes was filtered out
                    consumed += n;
                    if consumed < received_bytes {
                        trace!("Multiple messages in payload");
                    } else {
                        return Ok(None);
                    }
                }
                Ok((_, ParsedMessage::Item(m))) => {
                    consumed += m.byte_len() as usize;
                    let msg_with_storage_header = match m.storage_header {
                        Some(_) => m,
                        None => m.add_storage_header(None),
                    };
                    messages.push(msg_with_storage_header);
                    if consumed >= received_bytes {
                        return Ok(Some(DltEvent::Messages(messages)));
                    } else {
                        trace!("Multiple messages in payload");
                    }
                }
                Err(DltParseError::IncompleteParse { .. }) => {
                    // TODO handle situation: multiple messages but last message is split
                    return Ok(None);
                }
                Err(DltParseError::ParsingHickup { .. }) => {
                    return Ok(None);
                }
                Err(e @ DltParseError::Unrecoverable { .. }) => {
                    // forward the received bytes and try the next frame
                    return Err(e);
                }
            }
        }
    }
}
