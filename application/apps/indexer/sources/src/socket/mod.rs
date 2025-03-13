use bufread::DeqBuffer;

pub mod tcp;
pub mod udp;

/// Maximum packet size for the internal temp buffer of socket byte-sources.
const MAX_DATAGRAM_SIZE: usize = 65_507;

/// Maximum capacity for the buffer of socket byte-sources.
const MAX_BUFF_SIZE: usize = 1024 * 1024;

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
fn hanlde_buff_capacity(buffer: &mut DeqBuffer) -> BuffCapacityState {
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
