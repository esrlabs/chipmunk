pub mod file;
pub mod process;
pub mod serial;
pub mod tcp;
pub mod udp;

pub use file::SourceFileInfo;
pub use process::ProcessConfig;
pub use serial::{BaudRate, SerialConfig};
pub use tcp::TcpConfig;
pub use udp::{MulticastItem, UdpConfig};

#[derive(Debug, Clone)]
pub enum ByteSourceConfig {
    File(SourceFileInfo),
    Stream(StreamConfig),
}

impl ByteSourceConfig {
    /// Checks if the source with the configurations is valid
    ///
    /// # Note:
    /// Function will be called in rendering loop and should be lightweight.
    pub fn is_valid(&self) -> bool {
        match self {
            ByteSourceConfig::File(file) => file.is_valid(),
            ByteSourceConfig::Stream(stream) => stream.is_valid(),
        }
    }

    pub fn validation_errors(&self) -> Vec<&str> {
        match self {
            ByteSourceConfig::File(file) => file.validation_errors(),
            ByteSourceConfig::Stream(stream) => stream.validation_errors(),
        }
    }
}

#[allow(unused)]
#[derive(Debug, Clone)]
pub enum StreamConfig {
    Process(ProcessConfig),
    Tcp(TcpConfig),
    Udp(UdpConfig),
    Serial(SerialConfig),
}

impl StreamConfig {
    pub fn is_valid(&self) -> bool {
        match self {
            StreamConfig::Process(config) => config.is_valid(),
            StreamConfig::Tcp(config) => config.is_valid(),
            StreamConfig::Udp(config) => config.is_valid(),
            StreamConfig::Serial(config) => config.is_valid(),
        }
    }

    pub fn validation_errors(&self) -> Vec<&str> {
        match self {
            StreamConfig::Process(config) => config.validation_errors(),
            StreamConfig::Tcp(config) => config.validation_errors(),
            StreamConfig::Udp(config) => config.validation_errors(),
            StreamConfig::Serial(config) => config.validation_errors(),
        }
    }
}
