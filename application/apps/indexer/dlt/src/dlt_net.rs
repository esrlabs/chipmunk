extern crate dirs;
use crate::dlt::*;
use crate::dlt_file::create_dlt_session_file;
use crate::dlt_parse::dlt_message;
use crate::dlt_parse::*;
use crate::fibex::FibexMetadata;
use crate::filtering;
use async_std::net::{Ipv4Addr, UdpSocket};
use crossbeam_channel as cc;
use failure::err_msg;
use futures::stream::StreamExt;
use futures::FutureExt;
use indexer_base::chunks::Chunk;
use indexer_base::chunks::{ChunkFactory, ChunkResults};
use indexer_base::config::SocketConfig;
use indexer_base::progress::*;
use indexer_base::utils;
use std::io::{BufWriter, Write};
use std::net::SocketAddr;
use std::rc::Rc;

#[derive(Debug, Fail)]
pub enum ConnectionError {
    #[fail(display = "socket configuration seems to be broken: {}", cause)]
    WrongConfiguration { cause: String },
    #[fail(display = "could not establish a connection: {}", reason)]
    UnableToConnect { reason: String },
    #[fail(display = "error trying to connect: {}", info)]
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
impl From<failure::Error> for ConnectionError {
    fn from(err: failure::Error) -> ConnectionError {
        ConnectionError::Other {
            info: format!("{}", err),
        }
    }
}
#[allow(clippy::too_many_arguments)]
pub async fn index_from_socket2(
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
        err_msg(format!(
            "you cannot not bind a UDP socket to {}",
            socket_config.bind_addr
        ))
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
        Msg(Result<Option<Message>, DltParseError>),
    }
    let shutdown_stream = shutdown_receiver.map(|_| {
        debug!("shutdown_receiver event");
        Event::Shutdown
    });
    let message_stream: futures::stream::Map<UdpMessageProducer, _> =
        udp_msg_producer.map(Event::Msg);
    let mut event_stream = futures::stream::select(message_stream, shutdown_stream);
    while let Some(event) = event_stream.next().await {
        let maybe_msg = match event {
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
            Event::Msg(Err(DltParseError::Unrecoverable { .. })) => break,
            Event::Msg(Err(DltParseError::IncompleteParse { .. })) => break,
        };
        match maybe_msg {
            Some(msg) => {
                trace!("socket: got msg ...({} bytes)", msg.byte_len());
                tmp_writer.write_all(&msg.as_bytes())?;
                let written_bytes_len =
                    utils::create_tagged_line_d(tag, &mut buf_writer, &msg, line_nr, true)?;
                line_nr += 1;
                if let Some(chunk) =
                    chunk_factory.create_chunk_if_needed(line_nr, written_bytes_len)
                {
                    buf_writer.flush()?;
                    let _ = update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }));
                }
            }
            None => {
                trace!("msg was filtered");
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
) -> Result<(), failure::Error> {
    trace!("create_index_and_mapping_dlt_from_socket");
    let res = match utils::next_line_nr(out_path) {
        Ok(initial_line_nr) => {
            let filter_config: Option<filtering::ProcessedDltFilterConfig> =
                dlt_filter.map(filtering::process_filter_config);
            match index_from_socket2(
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
                    Err(err_msg(cause))
                }
                Err(ConnectionError::UnableToConnect { reason }) => {
                    let _ = update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content: reason.clone(),
                        line: None,
                    }));
                    Err(err_msg(reason))
                }
                Err(ConnectionError::Other { info }) => {
                    let _ = update_channel.send(Err(Notification {
                        severity: Severity::ERROR,
                        content: info.clone(),
                        line: None,
                    }));
                    Err(err_msg(info))
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
            Err(err_msg(content))
        }
    };
    let _ = update_channel.send(Ok(IndexingProgress::Finished));
    res
}
struct UdpMessageProducer {
    socket: UdpSocket,
    update_channel: cc::Sender<ChunkResults>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
}
impl futures::Stream for UdpMessageProducer {
    type Item = Result<Option<Message>, DltParseError>;
    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context,
    ) -> futures::task::Poll<Option<Self::Item>> {
        let mut buf = [0u8; 65535];
        let (pending, _received_bytes) = {
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
            match dlt_message(
                &buf,
                self.filter_config.as_ref(),
                0,
                Some(&self.update_channel),
                self.fibex_metadata.clone(),
                false,
            ) {
                Ok((_, ParsedMessage::Invalid)) => futures::task::Poll::Ready(None),
                Ok((_, ParsedMessage::FilteredOut)) => futures::task::Poll::Ready(None),
                Ok((_, ParsedMessage::Item(m))) => {
                    let msg_with_storage_header = match m.storage_header {
                        Some(_) => m,
                        None => m.add_storage_header(None),
                    };
                    futures::task::Poll::Ready(Some(Ok(Some(msg_with_storage_header))))
                }
                Err(DltParseError::IncompleteParse { .. }) => futures::task::Poll::Pending,
                Err(e) => futures::task::Poll::Ready(Some(Err(e))),
            }
        }
    }
}
