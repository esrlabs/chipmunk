use crate::{ByteSource, Error as SourceError, ReloadInfo, SourceFilter};
use buf_redux::Buffer;
use log::trace;
use std::net::{IpAddr, Ipv4Addr};
use thiserror::Error;
use tokio::net::{ToSocketAddrs, UdpSocket};

#[derive(Error, Debug)]
pub enum UdpSourceError {
    #[error("IO Error: {0}")]
    Io(std::io::Error),
    #[error("Fail joining multicast group: {0}")]
    Join(String),
    #[error("Invalid address: {0}")]
    ParseAddr(std::net::AddrParseError),
    #[error("Invalid number: {0}")]
    ParseNum(std::num::ParseIntError),
    #[error("Config: {0}")]
    Config(stypes::NetError),
}

pub struct UdpSource {
    buffer: Buffer,
    socket: UdpSocket,
    tmp_buffer: Vec<u8>,
}

const MAX_DATAGRAM_SIZE: usize = 65_507;

impl UdpSource {
    pub async fn new<A: ToSocketAddrs>(
        addr: A,
        multicast: Vec<stypes::MulticastInfo>,
    ) -> Result<Self, UdpSourceError> {
        let socket = UdpSocket::bind(addr).await.map_err(UdpSourceError::Io)?;
        for multicast_info in &multicast {
            let multi_addr = multicast_info
                .multicast_addr()
                .map_err(UdpSourceError::Config)?;
            match multi_addr {
                IpAddr::V4(addr) => {
                    let inter: Ipv4Addr = match multicast_info.interface.as_ref() {
                        Some(s) => s.parse().map_err(UdpSourceError::ParseAddr)?,
                        None => Ipv4Addr::new(0, 0, 0, 0),
                    };
                    if let Err(e) = socket.join_multicast_v4(addr, inter) {
                        warn!("error joining multicast group: {e}");
                        return Err(UdpSourceError::Join(e.to_string()));
                    }
                    debug!(
                        "Joining UDP multicast group: socket.join_multicast_v4({}, {})",
                        addr, inter
                    );
                }
                IpAddr::V6(addr) => {
                    let inter: u32 = match multicast_info.interface.as_ref() {
                        Some(s) => s.parse::<u32>().map_err(UdpSourceError::ParseNum)?,
                        None => 0,
                    };
                    if let Err(e) = socket.join_multicast_v6(&addr, inter) {
                        warn!("error joining multicast group: {e}");
                        return Err(UdpSourceError::Join(e.to_string()));
                    }
                }
            };
        }

        Ok(Self {
            buffer: Buffer::new(),
            socket,
            tmp_buffer: vec![0u8; MAX_DATAGRAM_SIZE],
        })
    }
}

impl ByteSource for UdpSource {
    async fn load(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        // TODO use filter
        let (len, remote_addr) = self
            .socket
            .recv_from(&mut self.tmp_buffer)
            .await
            .map_err(|e| SourceError::Setup(format!("{e}")))?;
        trace!(
            "---> Received {} bytes from {:?}: {}",
            len,
            remote_addr,
            String::from_utf8_lossy(&self.tmp_buffer[..len])
        );
        if len > 0 {
            self.buffer.copy_from_slice(&self.tmp_buffer[..len]);
        }
        let available_bytes = self.buffer.len();

        Ok(Some(ReloadInfo::new(len, available_bytes, 0, None)))
    }

    fn current_slice(&self) -> &[u8] {
        self.buffer.buf()
    }

    fn consume(&mut self, offset: usize) {
        self.buffer.consume(offset)
    }

    fn len(&self) -> usize {
        self.buffer.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::general_source_reload_test;

    static MESSAGES: &[&str] = &["one", "two", "three"];

    #[tokio::test]
    async fn test_udp_reload() -> Result<(), UdpSourceError> {
        static SENDER: &str = "127.0.0.1:4000";
        static RECEIVER: &str = "127.0.0.1:5000";
        let send_socket = UdpSocket::bind(SENDER).await.map_err(UdpSourceError::Io)?;
        let send_handle = tokio::spawn(async move {
            for msg in MESSAGES {
                send_socket
                    .send_to(msg.as_bytes(), RECEIVER)
                    .await
                    .expect("could not send on socket");
            }
        });
        let mut udp_source = UdpSource::new(RECEIVER, vec![]).await?;
        let receive_handle = tokio::spawn(async move {
            for msg in MESSAGES {
                udp_source.load(None).await.unwrap();
                assert_eq!(udp_source.current_slice(), msg.as_bytes());
                udp_source.consume(msg.len());
            }
        });

        println!("UDP: Starting send and receive");
        let (_, rec_res) = tokio::join!(send_handle, receive_handle,);

        assert!(rec_res.is_ok());
        Ok(())
    }

    #[tokio::test]
    async fn test_general_source_reload() {
        static SENDER: &str = "127.0.0.1:4001";
        static RECEIVER: &str = "127.0.0.1:5001";
        let send_socket = UdpSocket::bind(SENDER)
            .await
            .map_err(UdpSourceError::Io)
            .unwrap();
        tokio::spawn(async move {
            for msg in MESSAGES {
                send_socket
                    .send_to(msg.as_bytes(), RECEIVER)
                    .await
                    .expect("could not send on socket");
            }
        });
        let mut udp_source = UdpSource::new(RECEIVER, vec![]).await.unwrap();

        general_source_reload_test(&mut udp_source).await;
    }
}
