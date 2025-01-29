use std::time::Duration;

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
}

impl ReconnectInfo {
    pub fn new(max_attempts: usize, internval: Duration) -> Self {
        Self {
            max_attempts,
            internval,
        }
    }
}

impl Default for ReconnectInfo {
    fn default() -> Self {
        Self::new(usize::MAX, Duration::from_secs(5))
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
