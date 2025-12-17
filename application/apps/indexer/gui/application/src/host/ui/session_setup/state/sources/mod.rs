pub mod file;
pub mod process;

pub use file::SourceFileInfo;
pub use process::ProcessConfig;

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
}

#[derive(Debug, Clone)]
pub enum StreamConfig {
    Process(ProcessConfig),
    Tcp,
    Udp,
    Serial,
}

impl StreamConfig {
    pub fn is_valid(&self) -> bool {
        match self {
            StreamConfig::Process(config) => config.is_valid(),
            StreamConfig::Tcp => todo!(),
            StreamConfig::Udp => todo!(),
            StreamConfig::Serial => todo!(),
        }
    }
}
