use crate::*;

/// Represents a list of serial ports.
///
/// This structure contains a vector of strings, where each string represents the name
/// or identifier of a serial port available on the system.
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct SerialPortsList(pub Vec<String>);
