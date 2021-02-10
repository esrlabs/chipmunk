extern crate dirs;
use crate::{
    dlt::*,
    dlt_file::create_dlt_session_file,
    dlt_parse::{dlt_message, *},
    fibex::FibexMetadata,
    filtering,
};
use bytes::BytesMut;
use crossbeam_channel as cc;
use indexer_base::{
    chunks::{Chunk, ChunkFactory, ChunkResults},
    config::SocketConfig,
    progress::*,
    utils,
};
use std::{
    io::{BufWriter, Write},
    net::{Ipv4Addr, SocketAddr},
    rc::Rc,
};
use thiserror::Error;
use tokio_stream::{wrappers::ReceiverStream, StreamExt};
use tokio_util::{codec::Decoder, udp::UdpFramed};

#[derive(Debug, Error)]
pub enum ConnectionError {
    #[error("socket configuration seems to be broken: {}", cause)]
    WrongConfiguration { cause: String },
    #[error("could not establish a connection: {}", reason)]
    UnableToConnect { reason: String },
    #[error("error trying to connect: {}", info)]
    Other { info: String },
    #[error(transparent)]
    Any(#[from] anyhow::Error),
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

#[allow(clippy::too_many_arguments)]
pub async fn index_from_socket(
    session_id: String,
    socket_config: SocketConfig,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    update_channel: cc::Sender<ChunkResults>,
    fibex_metadata: Option<FibexMetadata>,
    tag: &str,
    out_path: &std::path::PathBuf,
    initial_line_nr: usize,
    shutdown_receiver: tokio::sync::mpsc::Receiver<()>,
) -> Result<(), ConnectionError> {
    debug!("index_from_socket: with socket conf: {:?}", socket_config);
    let (out_file, current_out_file_size) = utils::get_out_file_and_size(true, out_path)?;
    let tmp_dlt_file = create_dlt_session_file(&session_id)?;

    let mut tmp_writer = BufWriter::new(tmp_dlt_file);
    let mut chunk_factory = ChunkFactory::new(0, current_out_file_size);
    let mut line_nr = initial_line_nr;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
    let s = format!("{}:{}", socket_config.bind_addr, socket_config.port);
    let bind_addr_and_port: SocketAddr = s.parse()?;
    debug!(
        "Binding UDP socket: tokio::net::UdpSocket::bind({})",
        bind_addr_and_port
    );
    let socket = tokio::net::UdpSocket::bind(bind_addr_and_port)
        .await
        .map_err(|e| {
            warn!("Error trying to bind to {}: {}", bind_addr_and_port, e);
            ConnectionError::Other {
                info: format!(
                    "You cannot not bind a UDP socket to {}",
                    socket_config.bind_addr
                ),
            }
        })?;
    if let Some(multicast_info) = socket_config.multicast_addr {
        let multi_addr = multicast_info.multiaddr.parse()?;
        let inter = match multicast_info.interface.as_ref() {
            Some(s) => s.parse()?,
            None => Ipv4Addr::new(0, 0, 0, 0),
        };
        debug!(
            "Joining UDP multicast group: socket.join_multicast_v4({}, {})",
            multi_addr, inter
        );
        if let Err(e) = socket.join_multicast_v4(multi_addr, inter) {
            let msg = format!("error joining multicast group: {}", e);
            warn!("{}", msg);
            return Err(ConnectionError::UnableToConnect { reason: msg });
        }
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
            fibex_metadata: fibex_metadata.map(Rc::new),
            update_channel: Some(update_channel.clone()),
        },
    );

    let mut shutdown_stream = ReceiverStream::new(shutdown_receiver);

    // listen for both a shutdown request and incomming messages
    // to do this we need to select over streams of the same type
    // the type we use to unify is this Event enum
    loop {
        tokio::select! {
            _ = shutdown_stream.next() => {
                    debug!("Received shutdown in index_from_socket");
                    let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                    break;
            }
            Some(msg) = message_stream.next() => {
                match msg {
                    Ok((dlt_event, _)) => {
                        match dlt_event {
                            DltEvent::Messages(msgs) => {
                                for m in msgs {
                                    tmp_writer.write_all(&m.as_bytes())?;
                                    let written_bytes_len = utils::create_tagged_line_d(
                                        tag,
                                        &mut buf_writer,
                                        &m,
                                        line_nr,
                                        true,
                                    )?;
                                    line_nr += 1;
                                    if let Some(chunk) = chunk_factory.add_bytes(line_nr, written_bytes_len)
                                    {
                                        buf_writer.flush()?;
                                        let _ = update_channel
                                            .send(Ok(IndexingProgress::GotItem { item: chunk }));
                                    }
                                }
                            },
                            DltEvent::Progress(p) => {
                                match p {
                                    Progress::Notification(n) => {
                                        let _ = update_channel.send(Err(n));
                                    }
                                    Progress::Ticks(Ticks { count, total}) => {
                                        let _ = update_channel.send(Ok(IndexingProgress::Progress {
                                            ticks: (count, total)
                                        }));
                                    }
                                    Progress::Stopped => {
                                        let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                                    }
                                }
                            }
                        }
                    }
                    Err(DltParseError::ParsingHickup { reason }) => {
                        debug!("parsing hickup: {}", reason);
                        let _ = update_channel.send(Err(Notification {
                            severity: Severity::WARNING,
                            content: format!("parsing faild for one message: {}", reason),
                            line: None,
                        }));
                    }
                    Err(e) => {
                        warn!("Unexpected error in message stream: {}", e);
                        break;
                    }
                }
            }
            else => break,
        }
    }

    tmp_writer.flush()?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub async fn create_index_and_mapping_dlt_from_socket(
    session_id: String,
    socket_config: SocketConfig,
    tag: &str,
    out_path: &std::path::PathBuf,
    dlt_filter: Option<filtering::DltFilterConfig>,
    update_channel: &cc::Sender<ChunkResults>,
    shutdown_receiver: tokio::sync::mpsc::Receiver<()>,
    fibex_metadata: Option<FibexMetadata>,
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
                fibex_metadata,
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

pub(crate) struct DltMessageDecoder {
    pub(crate) filter_config: Option<filtering::ProcessedDltFilterConfig>,
    pub(crate) fibex_metadata: Option<Rc<FibexMetadata>>,
    pub(crate) update_channel: Option<cc::Sender<ChunkResults>>,
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
            match dlt_message(
                &buf[consumed..],
                self.filter_config.as_ref(),
                0,
                self.update_channel.as_ref(),
                self.fibex_metadata.clone(),
                false,
            ) {
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
