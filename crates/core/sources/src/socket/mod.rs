pub mod tcp;
pub mod udp;

/// Maximum packet size for the internal temp buffer of socket byte-sources.
const MAX_DATAGRAM_SIZE: usize = 65_507;

/// Maximum capacity for the buffer of socket byte-sources.
const MAX_BUFF_SIZE: usize = 1024 * 1024;
