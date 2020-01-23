use std::time::{SystemTime, UNIX_EPOCH};
use indexer_base::chunks::Chunk;
use crate::dlt_parse::*;
use crate::dlt::*;
use std::rc::Rc;
use futures::FutureExt;
use futures::stream::StreamExt;
use indexer_base::progress::*;
use failure::err_msg;
use std::io::{BufWriter, Write};
use indexer_base::utils;
use indexer_base::config::SocketConfig;
use indexer_base::chunks::{ChunkFactory, ChunkResults};
use async_std::net::{Ipv4Addr, UdpSocket};
use std::net::SocketAddr;
use async_std::task;
use crate::dlt_parse::dlt_message;
use crate::fibex::FibexMetadata;
use crossbeam_channel as cc;
use crate::filtering;

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
    socket_config: SocketConfig,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    update_channel: cc::Sender<ChunkResults>,
    fibex_metadata: Option<FibexMetadata>,
    tag: &str,
    ecu_id: String,
    out_path: &std::path::PathBuf,
    initial_line_nr: usize,
    shutdown_receiver: async_std::sync::Receiver<()>,
) -> Result<(), ConnectionError> {
    trace!("index_from_socket for socket conf: {:?}", socket_config);
    let (out_file, current_out_file_size) = utils::get_out_file_and_size(true, out_path)?;
    let mut chunk_factory = ChunkFactory::new(0, current_out_file_size);
    let mut line_nr = initial_line_nr;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
    let s = format!("{}:{}", socket_config.bind_addr, socket_config.port);
    let bind_addr_and_port: SocketAddr = s.parse()?;
    let socket = UdpSocket::bind(bind_addr_and_port).await?;
    if let Some(multicast_info) = socket_config.multicast_addr {
        let multi_addr = multicast_info.multiaddr.parse()?;
        let inter = match multicast_info.interface {
            Some(s) => s.parse()?,
            None => Ipv4Addr::new(0, 0, 0, 0),
        };
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
        ecu_id,
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
        };
        match maybe_msg {
            Some(msg) => {
                // trace!("got msg ...({} bytes)", msg.as_bytes().len());
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
    Ok(())
}
#[allow(clippy::too_many_arguments)]
pub fn index_from_socket(
    socket_config: SocketConfig,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    update_channel: cc::Sender<ChunkResults>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
    tag: &str,
    ecu_id: String,
    out_path: &std::path::PathBuf,
    initial_line_nr: usize,
    shutdown_receiver: async_std::sync::Receiver<()>,
) -> Result<(), ConnectionError> {
    trace!("index_from_socket for socket conf: {:?}", socket_config);
    let (out_file, current_out_file_size) = utils::get_out_file_and_size(true, out_path)?;
    let mut chunk_factory = ChunkFactory::new(0, current_out_file_size);
    let mut line_nr = initial_line_nr;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
    let mut chunk_count = 0usize;
    let mut last_byte_index = 0usize;
    task::block_on(async {
        let s = format!("{}:{}", socket_config.bind_addr, socket_config.port);
        let bind_addr_and_port: SocketAddr = s.parse()?;
        let socket = UdpSocket::bind(bind_addr_and_port).await?;
        if let Some(multicast_info) = socket_config.multicast_addr {
            let multi_addr = multicast_info.multiaddr.parse()?;
            let inter = match multicast_info.interface {
                Some(s) => s.parse()?,
                None => Ipv4Addr::new(0, 0, 0, 0),
            };
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
            ecu_id,
            fibex_metadata,
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
        let message_stream = udp_msg_producer.map(Event::Msg);
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
            };
            match maybe_msg {
                Some(msg) => {
                    trace!("got msg ...({} bytes)", msg.as_bytes().len());
                    let written_bytes_len =
                        utils::create_tagged_line_d(tag, &mut buf_writer, &msg, line_nr, true)?;
                    line_nr += 1;
                    if let Some(chunk) =
                        chunk_factory.create_chunk_if_needed(line_nr, written_bytes_len)
                    {
                        chunk_count += 1;
                        last_byte_index = chunk.b.1;
                        buf_writer.flush()?;
                        let _ = update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }));
                    }
                }
                None => {
                    trace!("msg was filtered");
                }
            }
        }
        Ok(())
    })
}
#[allow(clippy::too_many_arguments)]
pub async fn create_index_and_mapping_dlt_from_socket(
    socket_config: SocketConfig,
    tag: &str,
    ecu_id: String,
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
                socket_config,
                filter_config,
                update_channel.clone(),
                fibex_metadata,
                tag,
                ecu_id,
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
    ecu_id: String,
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
        let pending = {
            let mut f = self.socket.recv_from(&mut buf).boxed();
            match f.as_mut().poll(cx) {
                futures::task::Poll::Pending => true,
                futures::task::Poll::Ready(Err(e)) => {
                    return futures::task::Poll::Ready(Some(Err(e.into())));
                }
                futures::task::Poll::Ready(Ok((_amt, _src))) => false,
            }
        };
        if pending {
            futures::task::Poll::Pending
        } else {
            match dlt_message(
                &buf,
                self.filter_config.as_ref(),
                0,
                Some(&self.update_channel),
                self.fibex_metadata.clone(),
                false,
            ) {
                Ok((_, ParsedMessage::Invalid)) => futures::task::Poll::Ready(None),
                Ok((_, ParsedMessage::Skipped)) => futures::task::Poll::Ready(None),
                Ok((_, ParsedMessage::Item(m))) => {
                    let msg_with_storage_header = match m.storage_header {
                        Some(_) => m,
                        None => {
                            let now = SystemTime::now();
                            let since_the_epoch = now
                                .duration_since(UNIX_EPOCH)
                                .unwrap_or(std::time::Duration::from_secs(0));
                            let in_ms = since_the_epoch.as_millis();
                            Message {
                                storage_header: Some(StorageHeader {
                                    timestamp: DltTimeStamp::from_ms(in_ms as u64),
                                    ecu_id: self.ecu_id.clone(),
                                }),
                                ..m
                            }
                        }
                    };
                    futures::task::Poll::Ready(Some(Ok(Some(msg_with_storage_header))))
                }
                Err(nom::Err::Incomplete(_n)) => futures::task::Poll::Pending,
                Err(nom::Err::Error(_e)) => {
                    futures::task::Poll::Ready(Some(Err(DltParseError::ParsingHickup {
                        reason: format!("{:?}", _e),
                    })))
                }
                Err(nom::Err::Failure(_e)) => {
                    futures::task::Poll::Ready(Some(Err(DltParseError::Unrecoverable {
                        cause: format!("{:?}", _e),
                    })))
                }
            }
        }
    }
}
