use indexer_base::config::MulticastInfo;
use parsers::dlt;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf};

#[derive(Debug, Serialize, Deserialize)]
pub enum ParserType {
    Dlt(DltParserSettings),
    Pcap(PcapParserSettings),
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
pub struct PcapParserSettings {
    pub dlt: DltParserSettings,
}

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
    pub cwd: PathBuf,
    pub command: String,
    pub args: Vec<String>,
    pub envs: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TCPTransportConfig {}

#[derive(Debug, Serialize, Deserialize)]
pub struct UDPTransportConfig {
    pub bind_addr: String,
    pub multicast: Vec<MulticastInfo>,
}

///
#[derive(Debug, Serialize, Deserialize)]
pub enum SourceType {
    File(PathBuf, ParserType),
    Stream(Transport, ParserType),
}
