use crate::dlt_parse::*;
use crate::dlt::*;
use std::rc::Rc;
use futures::FutureExt;
use futures::stream::StreamExt;

use failure::Error;

use indexer_base::progress::*;
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

#[allow(clippy::too_many_arguments)]
pub fn index_from_socket(
    socket_config: SocketConfig,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
    update_channel: cc::Sender<ChunkResults>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
    append: bool,
    tag: &str,
    out_path: &std::path::PathBuf,
    initial_line_nr: usize,
    shutdown_receiver: async_std::sync::Receiver<()>,
    // socket_addr: &str, // local socket bind address with port, e.g. "0.0.0.0:8888"
    // ip_address: &str,  // multicast address
) -> Result<(), Error> {
    trace!("index_from_socket for socket conf: {:?}", socket_config);
    let (out_file, current_out_file_size) = utils::get_out_file_and_size(append, out_path)?;
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
            socket.join_multicast_v4(multi_addr, inter)?;
        }
        trace!("created socket...");
        let p = UdpMessageProducer {
            socket,
            update_channel: update_channel.clone(),
            fibex_metadata,
            filter_config,
        };
        enum Event {
            Shutdown,
            Msg(Result<Option<Message>, DltParseError>),
        }
        let rec = shutdown_receiver.map(|_| {
            debug!("shutdown_receiver event");
            Event::Shutdown
        });
        let p_event = p.map(Event::Msg);
        let mut f = futures::stream::select(p_event, rec);
        while let Some(event) = f.next().await {
            let maybe_msg = match event {
                Event::Shutdown => {
                    debug!("received shutdown through future channel");
                    update_channel.send(Ok(IndexingProgress::Finished))?;
                    break;
                }
                Event::Msg(Ok(maybe_msg)) => maybe_msg,
                Event::Msg(Err(DltParseError::ParsingHickup { .. })) => None,
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
                        update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }))?;
                        buf_writer.flush()?;
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
struct UdpMessageProducer {
    socket: UdpSocket,
    update_channel: cc::Sender<ChunkResults>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
    filter_config: Option<filtering::ProcessedDltFilterConfig>,
}
impl UdpMessageProducer {
    #[allow(dead_code)]
    async fn new(
        update_channel: &cc::Sender<ChunkResults>,
        filter_config: Option<filtering::ProcessedDltFilterConfig>,
        fibex_metadata: Option<Rc<FibexMetadata>>,
    ) -> Result<UdpMessageProducer, std::io::Error> {
        let socket = UdpSocket::bind("0.0.0.0:8888").await?;
        let multi_addr = Ipv4Addr::new(234, 2, 2, 2);
        let inter = Ipv4Addr::new(0, 0, 0, 0);
        socket.join_multicast_v4(multi_addr, inter)?;
        Ok(UdpMessageProducer {
            socket,
            update_channel: update_channel.clone(),
            filter_config,
            fibex_metadata,
        })
    }
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
                Ok((_, None)) => futures::task::Poll::Ready(None),
                Ok((_, Some(m))) => futures::task::Poll::Ready(Some(Ok(Some(m)))),
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

pub fn receive_from_socket() -> Result<Option<Message>, DltParseError> {
    // let (out_file, current_out_file_size) = utils::get_out_file_and_size(append, &out_path)?;
    // let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
    task::block_on(async {
        let socket = UdpSocket::bind("0.0.0.0:8888").await?;
        let mut buf = [0u8; 65535];
        let multi_addr = Ipv4Addr::new(234, 2, 2, 2);
        let inter = Ipv4Addr::new(0, 0, 0, 0);
        socket.join_multicast_v4(multi_addr, inter)?;

        let (_amt, _src) = socket.recv_from(&mut buf).await?;
        let m = dlt_message(&buf, None, 0, None, None, false).unwrap().1;
        Ok(m)
    })
}
