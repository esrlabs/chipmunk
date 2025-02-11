use std::time::Duration;
use tokio::sync::watch::Sender;

pub mod tcp;
pub mod udp;

/// Defines methods on sockets to make them able to reconnect to server in case the
/// connection is lost.
trait ReconnectToServer {
    /// Tries to reconnect to the server when [`ReconnectInfo`] are defined.
    async fn reconnect(&mut self) -> ReconnectResult;
}

#[derive(Debug, Clone)]
/// Represents the needed infos to reconnect to the server once the connection is lost.
pub struct ReconnectInfo {
    /// Maximum number of attempts to reconnect to the server.
    max_attempts: usize,
    /// The time interval between each try to connect to server.
    internval: Duration,
    /// Channel to send information of the state of reconnecting progress.
    state_sender: Option<Sender<ReconnectStateMsg>>,
}

impl ReconnectInfo {
    pub fn new(
        max_attempts: usize,
        internval: Duration,
        state_sender: Option<Sender<ReconnectStateMsg>>,
    ) -> Self {
        Self {
            max_attempts,
            internval,
            state_sender,
        }
    }
}

impl Default for ReconnectInfo {
    fn default() -> Self {
        Self::new(usize::MAX, Duration::from_secs(5), None)
    }
}

#[derive(Debug)]
/// Represent the return result of reconfigur
enum ReconnectResult {
    /// Reconnection to server successful.
    Reconnected,
    /// Reconnect isn't configured on socket.
    NotConfigured,
    /// Error while reconnecting.
    Error(std::io::Error),
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
