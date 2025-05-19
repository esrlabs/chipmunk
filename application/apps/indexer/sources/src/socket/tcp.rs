use bufread::DeqBuffer;
use components::{ComponentDescriptor, MetadataDescriptor};
use definitions::*;
use reconnect::{ReconnectInfo, ReconnectResult, TcpReconnecter};
use socket2::{SockRef, TcpKeepalive};
use std::{io::Read, net::SocketAddr, time::Duration};
use stypes::SourceOrigin;
use tokio::net::TcpStream;

use super::{handle_buff_capacity, BuffCapacityState, MAX_BUFF_SIZE, MAX_DATAGRAM_SIZE};

pub mod reconnect;

/// Configurations for keep-alive probes in TCP communication.
#[derive(Debug, Clone)]
pub struct KeepAliveConfig {
    /// Set the amount of time after which TCP keep-alive probes will be sent on
    /// idle connections.
    time: Duration,
    /// Sets the time interval between TCP keep-alive probes.
    interval: Duration,
}

impl KeepAliveConfig {
    pub fn new(time: Duration, interval: Duration) -> Self {
        Self { time, interval }
    }
}

pub struct TcpSource {
    buffer: DeqBuffer,
    socket: TcpStream,
    tmp_buffer: Vec<u8>,
    reconnecter: Option<TcpReconnecter>,
}

impl TcpSource {
    pub async fn new(
        addr: &str,
        keepalive: Option<KeepAliveConfig>,
        reconnect_info: Option<ReconnectInfo>,
    ) -> Result<Self, std::io::Error> {
        let binding_address = addr.parse().map_err(std::io::Error::other)?;
        let socket = Self::create_socket(binding_address, keepalive.as_ref()).await?;
        let reconnecter =
            reconnect_info.map(|rec| TcpReconnecter::new(rec, binding_address, keepalive));
        Ok(Self {
            buffer: DeqBuffer::new(MAX_BUFF_SIZE),
            socket,
            tmp_buffer: vec![0u8; MAX_DATAGRAM_SIZE],
            reconnecter,
        })
    }

    async fn create_socket(
        binding_address: SocketAddr,
        keep_alive: Option<&KeepAliveConfig>,
    ) -> std::io::Result<TcpStream> {
        let socket = TcpStream::connect(binding_address).await?;
        if let Some(keepalive_config) = keep_alive {
            let socket_ref = SockRef::from(&socket);
            let keepalive = TcpKeepalive::new()
                .with_time(keepalive_config.time)
                .with_interval(keepalive_config.interval);
            socket_ref.set_tcp_keepalive(&keepalive)?;
        }

        Ok(socket)
    }
}

impl ByteSource for TcpSource {
    async fn load(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        // If buffer is almost full then skip loading and return the available bytes.
        // This can happen because some parsers will parse the first item of the provided slice
        // while the producer will call load on each iteration making data accumulate.
        match handle_buff_capacity(&mut self.buffer) {
            BuffCapacityState::CanLoad => {}
            BuffCapacityState::AlmostFull => {
                let available_bytes = self.len();
                return Ok(Some(ReloadInfo::new(0, available_bytes, 0, None)));
            }
        }

        // TODO use filter
        loop {
            if let Some(reconnecter) = self.reconnecter.as_mut() {
                if let Some(handle) = reconnecter.task_handle.as_mut() {
                    match handle.await {
                        Ok(ReconnectResult::Reconnected(socket)) => self.socket = socket,
                        Ok(ReconnectResult::Error(err)) => {
                            return Err(SourceError::Unrecoverable(format!(
                                "Reconnect to TCP failed. Error: {err}"
                            )))
                        }
                        Err(err) => {
                            return Err(SourceError::Unrecoverable(format!(
                                "Reconnect to TCP task panicked. Error: {err}"
                            )))
                        }
                    }
                    reconnecter.task_handle = None;
                }
            }

            debug!("Wait for tcp socket to become readable");
            self.socket
                .readable()
                .await
                .map_err(|e| SourceError::Unrecoverable(format!("{e}")))?;
            debug!("Socket ready to read");
            match self.socket.try_read(&mut self.tmp_buffer) {
                Ok(len) => {
                    trace!("---> Received {} bytes", len);
                    if len == 0 {
                        // No data were received -> Server may be temporally down
                        // then try to reconnect.
                        if let Some(rec) = self.reconnecter.as_mut() {
                            rec.spawn_reconnect();
                            continue;
                        } else {
                            let available_bytes = self.buffer.read_available();

                            return Ok(Some(ReloadInfo::new(0, available_bytes, 0, None)));
                        }
                    }
                    let added = self.buffer.write_from(&self.tmp_buffer[..len]);
                    if added < len {
                        return Err(SourceError::Unrecoverable(format!(
                            "Internal buffer maximum capcity reached.\
                            Read from socekt: {len}, Copied to buffer: {added}"
                        )));
                    }
                    let available_bytes = self.buffer.read_available();

                    return Ok(Some(ReloadInfo::new(added, available_bytes, 0, None)));
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    continue;
                }
                Err(e) => {
                    // Server may be temporally down -> Try to reconnect.
                    if let Some(rec) = self.reconnecter.as_mut() {
                        rec.spawn_reconnect();
                        continue;
                    } else {
                        return Err(SourceError::Setup(format!(
                            " Reconnection failed with error: {e}"
                        )));
                    }
                }
            }
        }
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

const TCP_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05, 0x05,
]);

#[derive(Default)]
pub struct Descriptor {}

impl ComponentDescriptor<crate::Source> for Descriptor {
    fn create(
        &self,
        _origin: &SourceOrigin,
        _options: &[stypes::Field],
    ) -> Result<Option<crate::Source>, stypes::NativeError> {
        Ok(None)
    }
}

impl MetadataDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SourceOrigin) -> bool {
        match origin {
            SourceOrigin::File(..) | SourceOrigin::Files(..) => false,
            SourceOrigin::Source => true,
        }
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("TCP Source"),
            desc: String::from("TCP Source"),
            uuid: TCP_SOURCE_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Source
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::tests::general_source_reload_test;
    use reconnect::ReconnectStateMsg;
    use std::time::Duration;
    use tokio::{
        io::AsyncWriteExt,
        net::TcpListener,
        task::yield_now,
        time::{sleep, timeout},
    };

    static MESSAGES: &[&str] = &["one", "two", "three"];

    /// Accepts a connection from the provided listener and sends mock messages,  
    /// sleeping for the specified duration (in milliseconds) between messages.
    async fn accept_and_send(listener: &TcpListener, sleep_mili_sec: u64) {
        let (stream, _) = listener.accept().await.unwrap();
        let (_, mut send) = tokio::io::split(stream);
        // stream.writable().await.unwrap();
        for msg in MESSAGES {
            send.write_all(msg.as_bytes())
                .await
                .expect("could not send on socket");
            send.flush().await.expect("flush message should work");
            sleep(Duration::from_millis(sleep_mili_sec)).await;
        }
    }

    #[tokio::test]
    async fn test_tcp_reload() -> Result<(), std::io::Error> {
        static SERVER: &str = "127.0.0.1:4000";
        let listener = TcpListener::bind(&SERVER).await.unwrap();
        // process_socket(socket).await;
        // let send_socket = TcpSocket::bind(SENDER).await?;
        let send_handle = tokio::spawn(async move {
            accept_and_send(&listener, 100).await;
        });
        let mut tcp_source = TcpSource::new(SERVER, None, None).await?;
        let receive_handle = tokio::spawn(async move {
            for msg in MESSAGES {
                tcp_source.load(None).await.expect("reload failed");
                println!(
                    "receive: {:02X?}",
                    std::str::from_utf8(tcp_source.current_slice())
                );
                assert_eq!(tcp_source.current_slice(), msg.as_bytes());
                tcp_source.consume(msg.len());
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
            accept_and_send(&listener, 100).await;
        });
        let mut tcp_source = TcpSource::new(SERVER, None, None).await.unwrap();

        general_source_reload_test(&mut tcp_source).await;
    }

    /// Tests will send packets with fixed lengths while consuming
    /// half of the sent length, ensuring the source won't break.
    #[tokio::test]
    async fn test_source_buffer_overflow() {
        const SERVER: &str = "127.0.0.1:4002";
        let listener = TcpListener::bind(&SERVER).await.unwrap();

        const SENT_LEN: usize = MAX_DATAGRAM_SIZE;
        const CONSUME_LEN: usize = MAX_DATAGRAM_SIZE / 2;

        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            let msg = [b'a'; SENT_LEN];
            let mut total_sent = 0;
            while total_sent < MAX_BUFF_SIZE * 2 {
                send.write_all(&msg)
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                yield_now().await;
                total_sent += msg.len();
            }
        });

        let mut tcp_source = TcpSource::new(SERVER, None, None).await.unwrap();

        while let Ok(Some(info)) = tcp_source.load(None).await {
            if info.available_bytes == 0 {
                break;
            }
            tcp_source.consume(info.available_bytes.min(CONSUME_LEN));
        }
    }

    #[tokio::test]
    async fn reconnect_no_msgs() {
        static SERVER: &str = "127.0.0.1:4003";
        let listener = TcpListener::bind(&SERVER).await.unwrap();
        let send_handle = tokio::spawn(async move {
            accept_and_send(&listener, 30).await;
            // Then disconnected the server and sleep.
            drop(listener);
            sleep(Duration::from_millis(150)).await;

            // Start new server sending data again.
            let listener = TcpListener::bind(&SERVER).await.unwrap();
            accept_and_send(&listener, 30).await;
        });

        // Enable reconnect without configuring state channels.
        let rec_info = ReconnectInfo::new(1000, Duration::from_millis(20), None);

        let mut tcp_source = TcpSource::new(SERVER, None, Some(rec_info)).await.unwrap();
        let receive_handle = tokio::spawn(async move {
            // Byte source must receive same data twice without errors with active reconnect
            for _ in 0..2 {
                for msg in MESSAGES {
                    tcp_source.load(None).await.expect("reload failed");
                    println!(
                        "receive: {:02X?}",
                        std::str::from_utf8(tcp_source.current_slice())
                    );
                    assert_eq!(tcp_source.current_slice(), msg.as_bytes());
                    tcp_source.consume(msg.len());
                }
            }
        });

        let (_, rec_res) = tokio::join!(send_handle, receive_handle);

        assert!(rec_res.is_ok());
    }

    #[tokio::test]
    async fn reconnect_with_state_msgs() {
        static SERVER: &str = "127.0.0.1:4004";
        let listener = TcpListener::bind(&SERVER).await.unwrap();
        let send_handle = tokio::spawn(async move {
            accept_and_send(&listener, 30).await;
            // Then disconnected the server and sleep.
            drop(listener);
            sleep(Duration::from_millis(160)).await;

            // Start new server sending data again.
            let listener = TcpListener::bind(&SERVER).await.unwrap();
            accept_and_send(&listener, 30).await;
        });

        // Enable reconnect with state channels.
        let (state_tx, mut state_rx) = tokio::sync::watch::channel(ReconnectStateMsg::Connected);

        let rec_info = ReconnectInfo::new(1000, Duration::from_millis(50), Some(state_tx));

        let mut tcp_source = TcpSource::new(SERVER, None, Some(rec_info)).await.unwrap();

        // Tests reconnecting state messages.
        let reconnect_handler = tokio::spawn(async move {
            let mut attempts = 0;
            loop {
                state_rx.changed().await.unwrap();
                match *state_rx.borrow_and_update() {
                    ReconnectStateMsg::Connected => break,
                    ReconnectStateMsg::Reconnecting { attempts: atts } => attempts = atts,
                    ReconnectStateMsg::Failed {
                        attempts,
                        ref err_msg,
                    } => {
                        panic!(
                            "Reconnect failed. attempts: {attempts}, Error: {}",
                            err_msg.to_owned().unwrap_or_default()
                        )
                    }
                };
            }

            // In 160 Milliseconds Down time and reconnect interval of 50 Milliseconds
            // we must get at least 4 reconnect attempts.
            assert!(
                attempts >= 4,
                "Reconnect attempts {attempts} can't be less than 4"
            );
        });

        let receive_handle = tokio::spawn(async move {
            // Byte source must receive same data twice without errors with active reconnect
            for _ in 0..2 {
                for msg in MESSAGES {
                    tcp_source.load(None).await.expect("reload failed");
                    println!(
                        "receive: {:02X?}",
                        std::str::from_utf8(tcp_source.current_slice())
                    );
                    assert_eq!(tcp_source.current_slice(), msg.as_bytes());
                    tcp_source.consume(msg.len());
                }
            }
        });

        let (_, rec_res, reconnect_res) =
            tokio::join!(send_handle, receive_handle, reconnect_handler);

        assert!(rec_res.is_ok());
        assert!(reconnect_res.is_ok());
    }

    #[tokio::test]
    async fn reconnect_fail() {
        static SERVER: &str = "127.0.0.1:4005";
        let listener = TcpListener::bind(&SERVER).await.unwrap();
        let send_handle = tokio::spawn(async move {
            accept_and_send(&listener, 30).await;
        });

        // Enable reconnect with state channels.
        let (state_tx, mut state_rx) = tokio::sync::watch::channel(ReconnectStateMsg::Connected);

        const MAX_ATTEMPTS: usize = 7;
        let rec_info = ReconnectInfo::new(MAX_ATTEMPTS, Duration::from_millis(10), Some(state_tx));

        let mut tcp_source = TcpSource::new(SERVER, None, Some(rec_info)).await.unwrap();

        // Tests reconnecting state messages.
        // Failed state message with MAX_ATTEMPTS is expected.
        let reconnect_handler = tokio::spawn(async move {
            loop {
                state_rx.changed().await.unwrap();
                match *state_rx.borrow_and_update() {
                    ReconnectStateMsg::Connected => panic!("Connected state not expected"),
                    ReconnectStateMsg::Reconnecting { attempts: _ } => {}
                    ReconnectStateMsg::Failed {
                        attempts,
                        err_msg: _,
                    } => {
                        assert_eq!(attempts, MAX_ATTEMPTS);
                        break;
                    }
                };
            }
        });

        let receive_handle = tokio::spawn(async move {
            // Byte source must receive some data then receive and error on failing reconnect.
            for msg in MESSAGES {
                tcp_source.load(None).await.expect("reload failed");
                println!(
                    "receive: {:02X?}",
                    std::str::from_utf8(tcp_source.current_slice())
                );
                assert_eq!(tcp_source.current_slice(), msg.as_bytes());
                tcp_source.consume(msg.len());
            }
            assert!(tcp_source.load(None).await.is_err());
        });

        let (_, rec_res, reconnect_res) =
            tokio::join!(send_handle, receive_handle, reconnect_handler);

        assert!(rec_res.is_ok());
        assert!(reconnect_res.is_ok());
    }

    /// Ensure load and reconnect functions are cancel safe by keep sending notifications
    /// in rapid interval while calling them.
    #[tokio::test]
    async fn load_reconnect_cancel_safe() {
        static SERVER: &str = "127.0.0.1:4006";
        let listener = TcpListener::bind(&SERVER).await.unwrap();
        let send_handle = tokio::spawn(async move {
            accept_and_send(&listener, 30).await;
            // Then disconnected the server and sleep.
            drop(listener);
            sleep(Duration::from_millis(150)).await;

            // Start new server sending data again.
            let listener = TcpListener::bind(&SERVER).await.unwrap();
            accept_and_send(&listener, 30).await;
        });

        // Enable reconnect without configuring state channels.
        let rec_info = ReconnectInfo::new(1000, Duration::from_millis(30), None);

        let (cancel_tx, mut cancel_rx) = tokio::sync::mpsc::channel(32);

        let mut tcp_source = TcpSource::new(SERVER, None, Some(rec_info)).await.unwrap();

        let cancel_handle = tokio::spawn(async move {
            // Keep sending notifications causing load method to be dropped while both
            // receiving data and reconnecting to ensure their cancel safety.
            let mut sent = 0;
            while cancel_tx.send(()).await.is_ok() {
                sent += 1;
                sleep(Duration::from_millis(2)).await;
            }

            // Ensure messages are actually sent.
            assert!(sent > 50);
        });

        let receive_handle = tokio::spawn(async move {
            // TCP source must receive three messages, reconnect then receive three
            // more messages while receiving notifications with 2 milliseconds interval
            // to prove its cancel safety while loading and reconnecting.
            let mut idx = 0;
            let mut received_cancels = 0;
            while idx < MESSAGES.len() * 2 {
                tokio::select! {
                    _ = cancel_rx.recv() => {
                        received_cancels += 1;
                    }
                    Ok(Some(_)) = tcp_source.load(None) => {
                        let msg = MESSAGES[idx % MESSAGES.len()];
                        assert_eq!(tcp_source.current_slice(), msg.as_bytes());
                        tcp_source.consume(msg.len());
                        idx += 1;
                    }
                };
            }

            // Ensure cancel messages are actually received.
            assert!(received_cancels > 50);
        });

        let (_, rec_res, can_res) = tokio::join!(send_handle, receive_handle, cancel_handle);

        assert!(rec_res.is_ok());
        assert!(can_res.is_ok());
    }

    /// Ensure load and reconnect functions are cancel safe by keep calling it within a timeout
    /// function with rapid interval.
    #[tokio::test]
    async fn load_reconnect_cancel_safe_timeout() {
        static SERVER: &str = "127.0.0.1:4007";
        let listener = TcpListener::bind(&SERVER).await.unwrap();
        let send_handle = tokio::spawn(async move {
            accept_and_send(&listener, 30).await;
            // Then disconnected the server and sleep.
            drop(listener);
            sleep(Duration::from_millis(150)).await;

            // Start new server sending data again.
            let listener = TcpListener::bind(&SERVER).await.unwrap();
            accept_and_send(&listener, 30).await;
        });

        // Enable reconnect without configuring state channels.
        let rec_info = ReconnectInfo::new(1000, Duration::from_millis(30), None);

        let mut tcp_source = TcpSource::new(SERVER, None, Some(rec_info)).await.unwrap();

        let receive_handle = tokio::spawn(async move {
            // TCP source must receive three messages, reconnect then receive three
            // more messages while receiving notifications with 2 milliseconds interval
            // to prove its cancel safety while loading and reconnecting.
            let mut idx = 0;
            let mut received_timeout = 0;
            while idx < MESSAGES.len() * 2 {
                match timeout(Duration::from_millis(2), tcp_source.load(None)).await {
                    Ok(_) => {
                        let msg = MESSAGES[idx % MESSAGES.len()];
                        assert_eq!(tcp_source.current_slice(), msg.as_bytes());
                        tcp_source.consume(msg.len());
                        idx += 1;
                    }
                    Err(_elapsed) => received_timeout += 1,
                }
            }

            // Ensure cancel messages are actually received.
            assert!(received_timeout > 50);
        });

        let (_, rec_res) = tokio::join!(send_handle, receive_handle);

        assert!(rec_res.is_ok());
    }
}
