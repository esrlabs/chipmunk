use crate::{ByteSource, Error as SourceError, ReloadInfo, SourceFilter};
use bufread::DeqBuffer;
use tokio::net::{TcpStream, ToSocketAddrs};

pub struct TcpSource {
    buffer: DeqBuffer,
    socket: TcpStream,
    tmp_buffer: Vec<u8>,
}

const MAX_DATAGRAM_SIZE: usize = 65_507;

impl TcpSource {
    pub async fn new<A: ToSocketAddrs>(addr: A) -> Result<Self, std::io::Error> {
        Ok(Self {
            buffer: DeqBuffer::new(8192),
            socket: TcpStream::connect(addr).await?,
            tmp_buffer: vec![0u8; MAX_DATAGRAM_SIZE],
        })
    }
}

impl ByteSource for TcpSource {
    async fn load(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        // TODO use filter
        loop {
            debug!("Wait for tcp socket to become readable");
            self.socket
                .readable()
                .await
                .map_err(|e| SourceError::Unrecoverable(format!("{e}")))?;
            debug!("Socket ready to read");
            match self.socket.try_read(&mut self.tmp_buffer) {
                Ok(len) => {
                    trace!("---> Received {} bytes", len);
                    if len > 0 {
                        self.buffer.write_from(&self.tmp_buffer[..len]);
                    }
                    let available_bytes = self.buffer.read_available();
                    return Ok(Some(ReloadInfo::new(len, available_bytes, 0, None)));
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    continue;
                }
                Err(e) => {
                    return Err(SourceError::Setup(format!("{e}")));
                }
            }
        }
        // let len = self
        //     .socket
        //     .try_read(&mut self.tmp_buffer)
        //     .map_err(|e| SourceError::Setup(format!("{}", e)))?;
    }

    fn current_slice(&self) -> &[u8] {
        self.buffer.read_slice()
    }

    fn consume(&mut self, offset: usize) {
        self.buffer.read_done(offset);
    }

    fn len(&self) -> usize {
        self.buffer.read_available()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::tests::general_source_reload_test;
    use std::time::Duration;
    use tokio::{io::AsyncWriteExt, net::TcpListener, time::sleep};

    static MESSAGES: &[&str] = &["one", "two", "three"];

    #[tokio::test]
    async fn test_tcp_reload() -> Result<(), std::io::Error> {
        static SERVER: &str = "127.0.0.1:4000";
        let listener = TcpListener::bind(&SERVER).await.unwrap();
        // process_socket(socket).await;
        // let send_socket = TcpSocket::bind(SENDER).await?;
        let send_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            // stream.writable().await.unwrap();
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(100)).await;
            }
        });
        let mut udp_source = TcpSource::new(SERVER).await?;
        let receive_handle = tokio::spawn(async move {
            for msg in MESSAGES {
                udp_source.load(None).await.expect("reload failed");
                println!(
                    "receive: {:02X?}",
                    std::str::from_utf8(udp_source.current_slice())
                );
                assert_eq!(udp_source.current_slice(), msg.as_bytes());
                udp_source.consume(msg.len());
            }
        });

        println!("TCP: Starting send and receive");
        let (_, rec_res) = tokio::join!(send_handle, receive_handle,);

        assert!(rec_res.is_ok());
        Ok(())
    }

    #[tokio::test]
    async fn test_general_source_reload() {
        static SERVER: &str = "127.0.0.1:4001";
        let listener = TcpListener::bind(&SERVER).await.unwrap();
        // process_socket(socket).await;
        // let send_socket = TcpSocket::bind(SENDER).await?;
        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            // stream.writable().await.unwrap();
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(100)).await;
            }
        });
        let mut tcp_source = TcpSource::new(SERVER).await.unwrap();

        general_source_reload_test(&mut tcp_source).await;
    }
}
