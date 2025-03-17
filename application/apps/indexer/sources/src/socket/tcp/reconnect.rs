use std::{net::SocketAddr, time::Duration};
use tokio::{
    net::TcpStream,
    sync::watch,
    task::{yield_now, JoinHandle},
};

use super::KeepAliveConfig;

#[derive(Debug, Clone)]
/// Represents the needed infos to reconnect to the server once the connection is lost.
pub struct ReconnectInfo {
    /// Maximum number of attempts to reconnect to the server.
    max_attempts: usize,
    /// The time interval between each try to connect to server.
    interval: Duration,
    /// Channel to send information of the state of reconnecting progress.
    state_sender: Option<watch::Sender<ReconnectStateMsg>>,
}

impl ReconnectInfo {
    pub fn new(
        max_attempts: usize,
        interval: Duration,
        state_sender: Option<watch::Sender<ReconnectStateMsg>>,
    ) -> Self {
        Self {
            max_attempts,
            interval,
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

#[derive(Debug)]
/// Represent the return result of reconnect function.
pub enum ReconnectResult {
    /// Reconnection to server successful.
    Reconnected(TcpStream),
    /// Error while reconnecting.
    Error(std::io::Error),
}

/// Struct to manage reconnecting to TCP server.
#[derive(Debug)]
pub struct TcpReconnecter {
    reconnect_info: ReconnectInfo,
    binding_address: SocketAddr,
    keep_alive: Option<KeepAliveConfig>,
    /// Handle of spawned reconnecting task.
    pub task_handle: Option<JoinHandle<ReconnectResult>>,
}

impl TcpReconnecter {
    pub fn new(
        reconnect_info: ReconnectInfo,
        binding_address: SocketAddr,
        keep_alive: Option<KeepAliveConfig>,
    ) -> Self {
        Self {
            reconnect_info,
            task_handle: None,
            binding_address,
            keep_alive,
        }
    }

    /// Spawns a reconnect task setting its handle to the field [`Self::task_handle`]
    ///
    /// # Panics:
    ///
    /// This function panics if there is an already spawned task which hadn't been consumed yet.
    pub fn spawn_reconnect(&mut self) {
        assert!(
            self.task_handle.is_none(),
            "There must be no spawned reconnect task when spawn reconnect is called"
        );
        let hanlde = tokio::spawn(reconnect(
            self.reconnect_info.clone(),
            self.binding_address,
            self.keep_alive.clone(),
        ));

        self.task_handle = Some(hanlde);
    }
}

impl Drop for TcpReconnecter {
    fn drop(&mut self) {
        if let Some(task) = self.task_handle.take() {
            task.abort();
        }
    }
}

async fn reconnect(
    reconnect_info: ReconnectInfo,
    binding_address: SocketAddr,
    keep_alive: Option<KeepAliveConfig>,
) -> ReconnectResult {
    let mut attempts = 0;
    loop {
        attempts += 1;
        if let Some(sender) = &reconnect_info.state_sender {
            sender.send_replace(ReconnectStateMsg::Reconnecting { attempts });
        }
        log::info!("Reconnecting to TCP server. Attempt: {attempts}");

        match super::TcpSource::create_socket(binding_address, keep_alive.as_ref()).await {
            Ok(socket) => {
                if let Some(sender) = &reconnect_info.state_sender {
                    if let Err(err) = sender.send(ReconnectStateMsg::Connected) {
                        log::error!("Failed to send connected state with err: {err}");
                    }
                }
                return ReconnectResult::Reconnected(socket);
            }
            Err(err) => {
                log::debug!("Got following error while trying to reconnect: {err}");
                if attempts >= reconnect_info.max_attempts {
                    if let Some(sender) = &reconnect_info.state_sender {
                        sender.send_replace(ReconnectStateMsg::Failed {
                            attempts,
                            err_msg: Some(err.to_string()),
                        });
                        // Make sure the message has been sent before returning.
                        yield_now().await;
                    }
                    log::warn!("Reconnecting to TCP server failed after {attempts} attemps.");

                    return ReconnectResult::Error(err);
                }
            }
        }

        tokio::time::sleep(reconnect_info.interval).await;
    }
}
