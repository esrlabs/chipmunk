use std::{sync::Arc, time::Duration};

use tokio::{
    net::TcpStream,
    select,
    sync::{mpsc, watch, RwLock},
    task::{yield_now, JoinHandle},
    time::timeout,
};

use super::ConnectionState;

#[derive(Debug, Clone)]
/// Represents the needed infos to reconnect to TCP server once the connection is lost.
pub struct ReconnectInfo {
    /// Timeout duration to wait for the server to provide more data before
    /// assuming that the connection to the server is lost.
    read_timeout: Duration,
    /// Time interval between each check for server connection.
    check_internval: Duration,
    /// Maximum number of attempts to reconnect to the server.
    max_attempts: usize,
    /// Time interval between each try to connect to server.
    reconnect_internval: Duration,
    /// Channel to send information of the state of reconnecting progress.
    state_sender: Option<watch::Sender<ReconnectStateMsg>>,
}

impl ReconnectInfo {
    /// Create new instance of reconnect infos.
    ///
    /// * `read_timeout`: Timeout duration to wait for the server to provide more data before
    ///   assuming that the connection to the server is lost.
    /// * `check_internval`: Time interval between each check for server connection
    /// * `max_attempts`: Maximum number of attempts to reconnect to the server
    /// * `reconnect_internval`: Time interval between each try to connect to server
    /// * `state_sender`: Channel to send information of the state of reconnecting progress.
    pub fn new(
        read_timeout: Duration,
        check_internval: Duration,
        max_attempts: usize,
        reconnect_internval: Duration,
        state_sender: Option<watch::Sender<ReconnectStateMsg>>,
    ) -> Self {
        Self {
            read_timeout,
            check_internval,
            max_attempts,
            reconnect_internval,
            state_sender,
        }
    }
}

#[derive(Debug, Clone)]
/// Represent the information of the state of the reconnection progress.
pub enum ReconnectStateMsg {
    Connected,
    Reconnecting {
        attempts: usize,
    },
    Failed {
        attempts: usize,
        err_msg: Option<String>,
    },
}

/// Runs reconnecting task managing the communication between this struct and
/// the running task.
///
/// # Notes:
/// - Reconnect task is responsible of setting current connection state.
/// - This struct can send reconnect requests to reconnect task.
#[derive(Debug)]
pub struct ReconnectHandler {
    pub state_rx: watch::Receiver<ConnectionState>,
    pub request_tx: mpsc::Sender<()>,
    pub read_timeout: Duration,
    reconnect_task: JoinHandle<()>,
}

impl ReconnectHandler {
    /// Spawns reconnect task and create an instance to communicate with it.
    ///
    /// * `socket`: `TcpStream` used in the byte source to be used in connection checks
    ///   and to be replaced with new socket on successful reconnects.
    /// * `reconnect_info`: Reconnect parameters.
    /// * `binding_address`: Binding address of [`TcpStream`].
    pub fn new(
        socket: Arc<RwLock<TcpStream>>,
        reconnect_info: ReconnectInfo,
        binding_address: String,
    ) -> Self {
        let (state_tx, state_rx) = watch::channel(ConnectionState::Connected);
        let (request_tx, request_rx) = mpsc::channel(1);
        let read_timeout = reconnect_info.read_timeout;
        let reconnect_task = tokio::spawn(reconnect_task(
            socket.clone(),
            binding_address,
            reconnect_info,
            state_tx,
            request_rx,
        ));

        ReconnectHandler {
            state_rx,
            request_tx,
            read_timeout,
            reconnect_task,
        }
    }
}

impl Drop for ReconnectHandler {
    fn drop(&mut self) {
        if !self.reconnect_task.is_finished() {
            self.reconnect_task.abort();
        }
    }
}

/// Task to periodically check the connection to the server and attempt to reconnect when it's down.
/// Additionally, it listens to reconnect requests provided via `request_rx`.
///
/// # Notes:
/// - This task updates the internal connection state using `state_tx` sender.
/// - It also updates the external reconnecting state if available in `reconnect_info`.
/// - It will replace `socket` with a new one when the reconnection is successful.
async fn reconnect_task(
    socket: Arc<RwLock<TcpStream>>,
    binding_address: String,
    reconnect_info: ReconnectInfo,
    state_tx: watch::Sender<ConnectionState>,
    mut request_rx: mpsc::Receiver<()>,
) {
    let mut check_internval = tokio::time::interval(reconnect_info.check_internval);
    loop {
        select! {
        Some(()) = request_rx.recv() => {
            if !reconnect(socket.clone(), &state_tx, &reconnect_info, &binding_address).await {
                return;
            }
        },

        _ = check_internval.tick() => {
            let socket_read = socket.read().await;
            match timeout(reconnect_info.read_timeout, socket_read.readable()).await {
                Ok(Ok(())) => {},
                Ok(Err(err)) => {
                    // Readable failed => Try to reconnect.
                    drop(socket_read);
                    log::info!("Error received on readable() in reconnect task: {err}");
                    if !reconnect(socket.clone(), &state_tx, &reconnect_info, &binding_address).await {
                        return;
                    }
                },
                Err(_elapsed) => {
                    // Timed out => Try to reconnect.
                    drop(socket_read);
                    if !reconnect(socket.clone(), &state_tx, &reconnect_info, &binding_address).await {
                        return;
                    }
                },
            }
        },
        }
    }
}

/// Tries to reconnect with the provided infos, replacing the socket on success, and
/// notifying listeners on the socket internal state and external listener when available.
///
/// # Note:
/// This task will acquire write lock on `socket` on successful reconnect. Make sure all
/// locks are dropped before calling it to avoid any dead-locks.
///
/// # Returns:
/// Returns `true` on success, otherwise it's return `false` after updating TCP server state
/// with error message.
async fn reconnect(
    socket: Arc<RwLock<TcpStream>>,
    state_tx: &watch::Sender<ConnectionState>,
    reconnect_info: &ReconnectInfo,
    binding_address: &str,
) -> bool {
    // Notify state listeners
    state_tx.send_replace(ConnectionState::Reconnecting);
    if let Some(sender) = &reconnect_info.state_sender {
        sender.send_replace(ReconnectStateMsg::Reconnecting { attempts: 0 });
        yield_now().await;
    }

    let mut attempts = 0;
    loop {
        attempts += 1;
        if let Some(sender) = &reconnect_info.state_sender {
            sender.send_replace(ReconnectStateMsg::Reconnecting { attempts });
        }
        log::info!("Reconnecting to TCP server. Attempt: {attempts}");

        match TcpStream::connect(binding_address).await {
            Ok(new_socket) => {
                {
                    log::debug!("Reconnected: Trying to replace current socket");
                    *socket.write().await = new_socket;
                }
                log::info!("Reconnected to TCP server");
                state_tx.send_replace(ConnectionState::Connected);
                if let Some(sender) = &reconnect_info.state_sender {
                    sender.send_replace(ReconnectStateMsg::Connected);
                }

                return true;
            }
            Err(err) => {
                log::debug!("Got following error while trying to reconnect: {err}");
                if attempts >= reconnect_info.max_attempts {
                    log::warn!("Reconnecting to TCP server failed after {attempts} attemps.");
                    state_tx.send_replace(ConnectionState::Disconnected(err.to_string()));
                    if let Some(sender) = &reconnect_info.state_sender {
                        sender.send_replace(ReconnectStateMsg::Failed {
                            attempts: reconnect_info.max_attempts,
                            err_msg: Some(err.to_string()),
                        });
                    }
                    return false;
                }
            }
        }

        tokio::time::sleep(reconnect_info.reconnect_internval).await;
    }
}
