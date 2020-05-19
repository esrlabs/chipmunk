extern crate dirs;
use crate::{
    dlt::*,
    dlt_file::create_dlt_session_file,
    dlt_parse::{dlt_message, *},
    fibex::FibexMetadata,
    filtering,
};
use async_std::net::{Ipv4Addr, UdpSocket};
use crossbeam_channel as cc;
use futures::{stream::StreamExt, FutureExt};
use indexer_base::{
    chunks::{Chunk, ChunkFactory, ChunkResults},
    config::SocketConfig,
    progress::*,
    utils,
};
use std::{
    io::{BufWriter, Write},
    net::SocketAddr,
    rc::Rc,
};
use thiserror::Error;

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
// impl From<failure::Error> for ConnectionError {
//     fn from(err: failure::Error) -> ConnectionError {
//         ConnectionError::Other {
//             info: format!("{}", err),
//         }
//     }
// }
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
    shutdown_receiver: async_std::sync::Receiver<()>,
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
    debug!("create UDP socket by binding to: {}", bind_addr_and_port);
    let socket = UdpSocket::bind(bind_addr_and_port).await.map_err(|e| {
        warn!("error trying to bind to {}: {}", bind_addr_and_port, e);
        ConnectionError::Other {
            info: format!(
                "you cannot not bind a UDP socket to {}",
                socket_config.bind_addr
            ),
        }
    })?;
    if let Some(multicast_info) = socket_config.multicast_addr {
        let multi_addr = multicast_info.multiaddr.parse()?;
        let inter = match multicast_info.interface {
            Some(s) => s.parse()?,
            None => Ipv4Addr::new(0, 0, 0, 0),
        };
        debug!(
            "joining UDP multicast group: {} on interface: {}",
            multi_addr, inter
        );
        if let Err(e) = socket.join_multicast_v4(multi_addr, inter) {
            return Err(ConnectionError::UnableToConnect {
                reason: format!("error joining multicast group: {}", e),
            });
        }
    }
    trace!("created socket...");
    // send (0,0),(0,0) to indicate connection established
    let _ = update_channel.send(Ok(IndexingProgress::GotItem {
        item: Chunk {
            r: (0, 0),
            b: (0, 0),
        },
    }));
    let udp_msg_producer = UdpMessageProducer {
        socket,
        update_channel: update_channel.clone(),
        fibex_metadata: fibex_metadata.map(Rc::new),
        filter_config,
    };
    // listen for both a shutdown request and incomming messages
    // to do this we need to select over streams of the same type
    // the type we use to unify is this Event enum
    enum Event {
        Shutdown,
        Msg(Result<Option<Vec<Message>>, DltParseError>),
    }
    let shutdown_stream = shutdown_receiver.map(|_| {
        debug!("shutdown_receiver event");
        Event::Shutdown
    });
    let message_stream: futures::stream::Map<UdpMessageProducer, _> =
        udp_msg_producer.map(Event::Msg);
    let mut event_stream = futures::stream::select(message_stream, shutdown_stream);
    while let Some(event) = event_stream.next().await {
        let maybe_msgs = match event {
            Event::Shutdown => {
                debug!("received shutdown through future channel");
                let _ = update_channel.send(Ok(IndexingProgress::Stopped));
                break;
            }
            Event::Msg(Ok(maybe_msg)) => maybe_msg,
            Event::Msg(Err(DltParseError::ParsingHickup { reason })) => {
                let _ = update_channel.send(Err(Notification {
                    severity: Severity::WARNING,
                    content: format!("parsing faild for one message: {}", reason),
                    line: None,
                }));
                None
            }
            Event::Msg(Err(_)) => break,
        };
        match maybe_msgs {
            Some(msgs) => {
                trace!("socket: got {} messages ...", msgs.len());
                for m in msgs {
                    tmp_writer.write_all(&m.as_bytes())?;
                    let written_bytes_len =
                        utils::create_tagged_line_d(tag, &mut buf_writer, &m, line_nr, true)?;
                    line_nr += 1;
                    if let Some(chunk) = chunk_factory.add_bytes(line_nr, written_bytes_len) {
                        buf_writer.flush()?;
                        let _ = update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }));
                    }
                }
            }
            None => {
                trace!("msg not parsed but we can continue");
            }
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
    shutdown_receiver: async_std::sync::Receiver<()>,
    fibex_metadata: Option<FibexMetadata>,
) -> Result<(), ConnectionError> {
    trace!("create_index_and_mapping_dlt_from_socket");
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
                Err(ConnectionError::WrongConfiguration { cause }) => {
                    let _ = update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content: cause.clone(),
                        line: None,
                    }));
                    Err(ConnectionError::Other { info: cause })
                }
                Err(ConnectionError::UnableToConnect { reason }) => {
                    let _ = update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content: reason.clone(),
                        line: None,
                    }));
                    Err(ConnectionError::Other { info: reason })
                }
                Err(ConnectionError::Other { info }) => {
                    let _ = update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content: info.clone(),
                        line: None,
                    }));
                    Err(ConnectionError::Other { info })
                }
                Err(ConnectionError::Any(e)) => {
                    let info = format!("{}", e);
                    let _ = update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content: info.clone(),
                        line: None,
                    }));
                    Err(ConnectionError::Other { info })
                }
                Ok(_) => Ok(()),
            }
        }
        Err(e) => {
            let content = format!(
                "could not determine last line number of {:?} ({})",
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
pub struct UdpMessageProducer {
    socket: UdpSocket,
    update_channel: cc::Sender<ChunkResults>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
}
impl UdpMessageProducer {
    pub fn new(
        socket: UdpSocket,
        update_channel: cc::Sender<ChunkResults>,
        fibex_metadata: Option<Rc<FibexMetadata>>,
        filter_config: Option<filtering::ProcessedDltFilterConfig>,
    ) -> Self {
        UdpMessageProducer {
            socket,
            update_channel,
            fibex_metadata,
            filter_config,
        }
    }
}
impl futures::Stream for UdpMessageProducer {
    type Item = Result<Option<Vec<Message>>, DltParseError>;
    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context,
    ) -> futures::task::Poll<Option<Self::Item>> {
        let mut buf = [0u8; 65535];
        let (pending, received_bytes) = {
            let mut f = self.socket.recv_from(&mut buf).boxed();
            match f.as_mut().poll(cx) {
                futures::task::Poll::Pending => (true, 0),
                futures::task::Poll::Ready(Err(e)) => {
                    return futures::task::Poll::Ready(Some(Err(e.into())));
                }
                futures::task::Poll::Ready(Ok((amt, _src))) => (false, amt),
            }
        };
        if pending {
            futures::task::Poll::Pending
        } else {
            // trace!(
            //     "UdpMessageProducer stream, received {} bytes: {:02X?}",
            //     received_bytes,
            //     &buf[..received_bytes]
            // );
            let mut messages: Vec<Message> = vec![];
            let mut consumed = 0usize;
            loop {
                match dlt_message(
                    &buf[consumed..],
                    self.filter_config.as_ref(),
                    0,
                    Some(&self.update_channel),
                    self.fibex_metadata.clone(),
                    false,
                ) {
                    Ok((_, ParsedMessage::Invalid)) => {
                        warn!("invalid message received");
                        if !messages.is_empty() {
                            return futures::task::Poll::Ready(Some(Ok(Some(messages))));
                        }
                        return futures::task::Poll::Ready(None);
                    }
                    Ok((_, ParsedMessage::FilteredOut)) => {
                        continue;
                    }
                    Ok((_, ParsedMessage::Item(m))) => {
                        consumed += m.byte_len() as usize;
                        let msg_with_storage_header = match m.storage_header {
                            Some(_) => m,
                            None => m.add_storage_header(None),
                        };
                        messages.push(msg_with_storage_header);
                        if consumed >= received_bytes {
                            debug!("received {} messages in upd packet", messages.len());
                            return futures::task::Poll::Ready(Some(Ok(Some(messages))));
                        }
                    }
                    Err(DltParseError::IncompleteParse { .. }) => {
                        // TODO handle situation: multiple messages but last message is split
                        return futures::task::Poll::Pending;
                    }
                    Err(e) => {
                        return futures::task::Poll::Ready(Some(Err(e)));
                    }
                }
            }
        }
    }
}
