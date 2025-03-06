use std::sync::Arc;

use crate::{ByteSource, Error as SourceError, ReloadInfo, SourceFilter};
use bufread::DeqBuffer;
use tokio::{net::TcpStream, sync::RwLock, time::timeout};

use super::{hanlde_buff_capacity, BuffCapacityState, MAX_BUFF_SIZE, MAX_DATAGRAM_SIZE};

mod reconnect;

use reconnect::ReconnectHandler;
pub use reconnect::{ReconnectInfo, ReconnectStateMsg};

#[derive(Debug, Clone)]
/// Represents the connection status of TCP byte source
enum ConnectionState {
    Connected,
    Reconnecting,
    Disconnected(String),
}

pub struct TcpSource {
    buffer: DeqBuffer,
    socket: Arc<RwLock<TcpStream>>,
    tmp_buffer: Vec<u8>,
    reconnect: Option<ReconnectHandler>,
}

impl TcpSource {
    pub async fn new<A: Into<String>>(
        addr: A,
        reconnect_info: Option<ReconnectInfo>,
    ) -> Result<Self, std::io::Error> {
        let binding_address: String = addr.into();
        let socket = Arc::new(RwLock::new(TcpStream::connect(&binding_address).await?));
        let reconnect = reconnect_info
            .map(|rec_info| ReconnectHandler::new(socket.clone(), rec_info, binding_address));

        Ok(Self {
            buffer: DeqBuffer::new(MAX_BUFF_SIZE),
            socket,
            tmp_buffer: vec![0u8; MAX_DATAGRAM_SIZE],
            reconnect,
        })
    }

    /// Sends request to reconnect then wait for the state to be changed from
    /// reconnect task then start from top of the loop.
    ///
    /// # Note:
    /// - This function is used inside `load()` function to reduce duplicated code and is suited
    ///   for that context only.
    ///
    /// - Reconnect will acquire write lock on `socket`. Make sure all locks are dropped before
    ///   calling it to avoid any dead-locks.
    async fn request_reconnect(reconnect: &mut ReconnectHandler) -> Result<(), SourceError> {
        if let Err(err) = reconnect.request_tx.send(()).await {
            let err_msg = format!("Communication error while requesting reconnect. {err}");
            log::error!("{err_msg}");

            return Err(SourceError::Unrecoverable(err_msg));
        }

        if let Err(err) = reconnect.state_rx.changed().await {
            let err_msg = format!("Communication error while waiting state to change. {err}");
            log::error!("{err_msg}");

            return Err(SourceError::Unrecoverable(err_msg));
        }

        Ok(())
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
        match hanlde_buff_capacity(&mut self.buffer) {
            BuffCapacityState::CanLoad => {}
            BuffCapacityState::AlmostFull => {
                let available_bytes = self.len();
                return Ok(Some(ReloadInfo::new(0, available_bytes, 0, None)));
            }
        }

        // TODO use filter
        loop {
            // Checks for connection status
            if let Some(reconnect) = &mut self.reconnect {
                let state = reconnect.state_rx.borrow_and_update().to_owned();
                match state {
                    ConnectionState::Connected => {}
                    ConnectionState::Reconnecting => {
                        // Wait until state changes.
                        match reconnect.state_rx.changed().await {
                            Ok(()) => continue, // State changed => run loop from start.
                            Err(err) => {
                                let err_msg =
                                    format!("Reconnect sender dropped unexpectedly. {err}");
                                log::error!("{}", err_msg);
                                return Err(SourceError::Unrecoverable(err_msg));
                            }
                        }
                    }
                    ConnectionState::Disconnected(err) => {
                        return Err(SourceError::Unrecoverable(err));
                    }
                }
            }

            debug!("Wait for tcp socket to become readable");
            let socket = self.socket.read().await;
            let mut readable_err = None;
            if let Some(reconnect) = &self.reconnect {
                // Apply timeout to avoid dead-locks in case load() method is never cancelled
                // and stuck in readable() while holding lock to the socket.
                match timeout(reconnect.read_timeout, socket.readable()).await {
                    Ok(Ok(())) => {}
                    Ok(Err(err)) => {
                        let err_msg = format!("TCP socket readable call failed. {err}");
                        log::warn!("{err_msg}");
                        readable_err = Some(err_msg);
                    }
                    Err(elapsed) => {
                        let err_msg = format!("TCP socket readable timed out after {elapsed}");
                        log::warn!("{err_msg}");
                        readable_err = Some(err_msg);
                    }
                }
            } else if let Err(err) = socket.readable().await {
                let err_msg = format!("TCP socket readable call failed. {err}");
                log::warn!("{err_msg}");
                readable_err = Some(err_msg);
            }

            // Handle readable errors trying to reconnect if configured.
            if let Some(err) = readable_err {
                if let Some(reconnect) = &mut self.reconnect {
                    drop(socket);
                    Self::request_reconnect(reconnect).await?;
                    continue;
                } else {
                    return Err(SourceError::Unrecoverable(err));
                }
            }

            debug!("Socket ready to read");
            match socket.try_read(&mut self.tmp_buffer) {
                Ok(len) => {
                    drop(socket);
                    trace!("---> Received {} bytes", len);
                    if len == 0 {
                        // No data were received -> Server may be temporally down
                        if let Some(reconnect) = &mut self.reconnect {
                            Self::request_reconnect(reconnect).await?;
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
                    drop(socket);
                    // Server may be temporally down -> Try to reconnect.
                    if let Some(reconnect) = &mut self.reconnect {
                        Self::request_reconnect(reconnect).await?;
                        continue;
                    } else {
                        return Err(SourceError::Unrecoverable(e.to_string()));
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

#[cfg(test)]
mod tests {
    use super::*;

    use crate::tests::general_source_reload_test;
    use std::time::Duration;
    use tokio::{io::AsyncWriteExt, net::TcpListener, task::yield_now, time::sleep};

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
        let mut tcp_source = TcpSource::new(SERVER, None).await?;
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
        let mut tcp_source = TcpSource::new(SERVER, None).await.unwrap();

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

        let mut tcp_source = TcpSource::new(SERVER, None).await.unwrap();

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
            // Run server sending data for first time.
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(30)).await;
            }

            // Then disconnected the server and sleep.
            drop(send);
            drop(listener);
            sleep(Duration::from_millis(150)).await;

            // Start new server sending data again.
            let listener = TcpListener::bind(&SERVER).await.unwrap();
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(30)).await;
            }
        });

        // Enable reconnect without configuring state channels.
        let rec_info = ReconnectInfo::new(
            Duration::from_millis(50),
            Duration::from_millis(50),
            1000,
            Duration::from_millis(20),
            None,
        );

        let mut tcp_source = TcpSource::new(SERVER, Some(rec_info)).await.unwrap();
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
            // Run server sending data for first time.
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(30)).await;
            }

            // Then disconnected the server and sleep.
            drop(send);
            drop(listener);
            sleep(Duration::from_millis(200)).await;

            // Start new server sending data again.
            let listener = TcpListener::bind(&SERVER).await.unwrap();
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(30)).await;
            }
        });

        // Enable reconnect with state channels.
        let (state_tx, mut state_rx) = tokio::sync::watch::channel(ReconnectStateMsg::Connected);

        let rec_info = ReconnectInfo::new(
            Duration::from_millis(50),
            Duration::from_millis(50),
            1000,
            Duration::from_millis(50),
            Some(state_tx),
        );

        let mut tcp_source = TcpSource::new(SERVER, Some(rec_info)).await.unwrap();

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

            // In 200 + 30 Milliseconds Down time and reconnect interval of 50 Milliseconds
            // we must get 5 reconnect attempts.
            assert_eq!(attempts, 5);
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
            // Run server sending some data then stop.
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(30)).await;
            }
        });

        // Enable reconnect with state channels.
        let (state_tx, mut state_rx) = tokio::sync::watch::channel(ReconnectStateMsg::Connected);

        const MAX_ATTEMPTS: usize = 7;
        let rec_info = ReconnectInfo::new(
            Duration::from_millis(50),
            Duration::from_millis(50),
            MAX_ATTEMPTS,
            Duration::from_millis(10),
            Some(state_tx),
        );

        let mut tcp_source = TcpSource::new(SERVER, Some(rec_info)).await.unwrap();

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
            // Run server sending data for first time.
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(30)).await;
            }

            // Then disconnected the server and sleep.
            drop(send);
            drop(listener);
            sleep(Duration::from_millis(150)).await;

            // Start new server sending data again.
            let listener = TcpListener::bind(&SERVER).await.unwrap();
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(30)).await;
            }
        });

        // Enable reconnect without configuring state channels.
        let rec_info = ReconnectInfo::new(
            Duration::from_millis(50),
            Duration::from_millis(50),
            1000,
            Duration::from_millis(30),
            None,
        );

        let (cancel_tx, mut cancel_rx) = tokio::sync::mpsc::channel(32);

        let mut tcp_source = TcpSource::new(SERVER, Some(rec_info)).await.unwrap();

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
            // Run server sending data for first time.
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(30)).await;
            }

            // Then disconnected the server and sleep.
            drop(send);
            drop(listener);
            sleep(Duration::from_millis(150)).await;

            // Start new server sending data again.
            let listener = TcpListener::bind(&SERVER).await.unwrap();
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(30)).await;
            }
        });

        // Enable reconnect without configuring state channels.
        let rec_info = ReconnectInfo::new(
            Duration::from_millis(50),
            Duration::from_millis(50),
            1000,
            Duration::from_millis(30),
            None,
        );

        let mut tcp_source = TcpSource::new(SERVER, Some(rec_info)).await.unwrap();

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
