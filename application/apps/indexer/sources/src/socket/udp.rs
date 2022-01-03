use crate::ByteSource;
use crate::Error as SourceError;
use crate::ReloadInfo;
use crate::SourceFilter;
use async_trait::async_trait;
use buf_redux::Buffer;
use tokio::net::ToSocketAddrs;
use tokio::net::UdpSocket;

pub struct UdpSource {
    buffer: Buffer,
    socket: UdpSocket,
    tmp_buffer: Vec<u8>,
}

impl UdpSource {
    pub async fn new<A: ToSocketAddrs>(addr: A) -> Result<Self, std::io::Error> {
        Ok(Self {
            buffer: Buffer::new(),
            socket: UdpSocket::bind(addr).await?,
            tmp_buffer: Vec::with_capacity(64 * 1024),
        })
    }
}

#[async_trait]
impl ByteSource for UdpSource {
    fn current_slice(&self) -> &[u8] {
        self.buffer.buf()
    }

    async fn reload(
        &mut self,
        filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        let (len, remote_addr) = self
            .socket
            .recv_from(&mut self.tmp_buffer)
            .await
            .map_err(|e| SourceError::Setup(format!("{}", e)))?;
        println!("reloaded {} bytes from {}", len, remote_addr);
        if len > 0 {
            self.buffer.copy_from_slice(&self.tmp_buffer[..len - 1]);
        }
        Ok(Some(ReloadInfo::new(len, 0, None)))
        // todo!()
    }

    fn consume(&mut self, offset: usize) {
        self.buffer.consume(offset)
    }

    fn len(&self) -> usize {
        self.buffer.len()
    }
}

#[tokio::test]
async fn test_udp_reload() {
    let send_socket = UdpSocket::bind("127.0.0.1:8888")
        .await
        .expect("could not bind socket");
    let content = "hello".as_bytes();
    let send_handle = tokio::spawn(async move {
        let len = send_socket
            .send_to(content, "127.0.0.1:8889")
            .await
            .expect("could not send on socket");
        println!("SENDER: sent {} bytes", len);
    });
    let mut udp_source = UdpSource::new("127.0.0.1:8889")
        .await
        .expect("could not create source");
    tokio::join!(send_handle, udp_source.reload(None));
    let content = udp_source.current_slice();
    println!(
        "test done: {}",
        std::str::from_utf8(content).expect("could not convert content to string")
    );
}
