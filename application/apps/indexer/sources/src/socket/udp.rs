use crate::{ByteSource, Error as SourceError, ReloadInfo, SourceFilter};
use async_trait::async_trait;
use buf_redux::Buffer;
use log::trace;
use tokio::net::{ToSocketAddrs, UdpSocket};

pub struct UdpSource {
    buffer: Buffer,
    socket: UdpSocket,
    tmp_buffer: Vec<u8>,
}

const MAX_DATAGRAM_SIZE: usize = 65_507;

impl UdpSource {
    pub async fn new<A: ToSocketAddrs>(addr: A) -> Result<Self, std::io::Error> {
        Ok(Self {
            buffer: Buffer::new(),
            socket: UdpSocket::bind(addr).await?,
            tmp_buffer: vec![0u8; MAX_DATAGRAM_SIZE],
        })
    }
}

#[async_trait]
impl ByteSource for UdpSource {
    async fn reload(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        // TODO use filter
        let (len, remote_addr) = self
            .socket
            .recv_from(&mut self.tmp_buffer)
            .await
            .map_err(|e| SourceError::Setup(format!("{}", e)))?;
        trace!(
            "---> Received {} bytes from {:?}: {}",
            len,
            remote_addr,
            String::from_utf8_lossy(&self.tmp_buffer[..len])
        );
        if len > 0 {
            self.buffer.copy_from_slice(&self.tmp_buffer[..len]);
        }

        Ok(Some(ReloadInfo::new(len, len, 0, None)))
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

#[tokio::test]
async fn test_udp_reload() -> Result<(), std::io::Error> {
    static SENDER: &str = "127.0.0.1:4000";
    static RECEIVER: &str = "127.0.0.1:5000";
    static MESSAGES: &[&str] = &["one", "two", "three"];
    let send_socket = UdpSocket::bind(SENDER).await?;
    let send_handle = tokio::spawn(async move {
        for msg in MESSAGES {
            send_socket
                .send_to(msg.as_bytes(), RECEIVER)
                .await
                .expect("could not send on socket");
        }
    });
    let mut udp_source = UdpSource::new(RECEIVER).await?;
    let receive_handle = tokio::spawn(async move {
        for msg in MESSAGES {
            udp_source.reload(None).await.unwrap();
            assert_eq!(udp_source.current_slice(), msg.as_bytes());
            udp_source.consume(msg.len());
        }
    });

    println!("starting send and receive");
    let (_, rec_res) = tokio::join!(send_handle, receive_handle,);

    assert!(rec_res.is_ok());
    Ok(())
}
