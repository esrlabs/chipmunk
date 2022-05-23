use indexer_base::config::MulticastInfo;
use parsers::dlt;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub enum ParserType {
    Dlt(DltParserSettings),
    PcapDlt(PcapDltParserSettings),
    SomeIP(SomeIPParserSettings),
    Text,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DltParserSettings {
    pub filter_config: Option<dlt::DltFilterConfig>,
    pub fibex_file_paths: Option<Vec<String>>,
    pub with_storage_header: bool,
}

impl Default for DltParserSettings {
    fn default() -> Self {
        Self {
            filter_config: None,
            fibex_file_paths: None,
            with_storage_header: true,
        }
    }
}

impl DltParserSettings {
    pub fn new_including_storage_headers(
        filter_config: Option<dlt::DltFilterConfig>,
        fibex_file_paths: Option<Vec<String>>,
    ) -> Self {
        Self {
            filter_config,
            fibex_file_paths,
            with_storage_header: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PcapDltParserSettings(pub DltParserSettings);

#[derive(Debug, Serialize, Deserialize)]
pub struct SomeIPParserSettings {}

#[derive(Debug, Serialize, Deserialize)]
pub enum Transport {
    Process(ProcessTransportConfig),
    TCP(ProcessTransportConfig),
    UDP(UDPTransportConfig),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessTransportConfig {
    pub cmd: PathBuf,
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TCPTransportConfig {
    pub dest_path: PathBuf,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UDPTransportConfig {
    pub bind_addr: String,
    pub multicast: Vec<MulticastInfo>,
    pub dest_path: PathBuf,
}

///
#[derive(Debug, Serialize, Deserialize)]
pub enum SourceType {
    File(PathBuf, ParserType),
    Stream(Transport, ParserType),
}
