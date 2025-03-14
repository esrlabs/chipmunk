use bufread::DeqBuffer;
use std::time::Duration;
use tokio::sync::watch::Sender;

pub mod tcp;
pub mod udp;

/// Maximum packet size for the internal temp buffer of socket byte-sources.
const MAX_DATAGRAM_SIZE: usize = 65_507;

/// Maximum capacity for the buffer of socket byte-sources.
const MAX_BUFF_SIZE: usize = 1024 * 1024;

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
    interval: Duration,
    /// Channel to send information of the state of reconnecting progress.
    state_sender: Option<Sender<ReconnectStateMsg>>,
}

impl ReconnectInfo {
    pub fn new(
        max_attempts: usize,
        interval: Duration,
        state_sender: Option<Sender<ReconnectStateMsg>>,
    ) -> Self {
        Self {
            max_attempts,
            interval,
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
/// Represent the return result of reconnect function.
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

/// Represents the capacity state of the buffer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BuffCapacityState {
    /// Buffer can be loaded with more data.
    CanLoad,
    /// Buffer is almost full. Loading it may cause data loss.
    AlmostFull,
}

/// Checks if the buffer can be loaded with more data, calling flush on it when necessary,
/// and return the buffer capacity state.
fn handle_buff_capacity(buffer: &mut DeqBuffer) -> BuffCapacityState {
    // Check if buffer has enough capacity for the next load call.
    if buffer.write_available() < MAX_DATAGRAM_SIZE {
        // Capacity isn't enough -> Try flushing the buffer.
        if buffer.flush() > 0 {
            // Check buffer capacity again after flush
            if buffer.write_available() < MAX_DATAGRAM_SIZE {
                BuffCapacityState::AlmostFull
            } else {
                BuffCapacityState::CanLoad
            }
        } else {
            // Flush didn't moved any bytes -> No capacity is freed up.
            BuffCapacityState::AlmostFull
        }
    } else {
        BuffCapacityState::CanLoad
    }
}
