use parsers::dlt;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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
    pub cmd: PathBuf,
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TCPTransportConfig {}

#[derive(Debug, Serialize, Deserialize)]
pub struct UDPTransportConfig {}

#[derive(Debug, Serialize, Deserialize)]
pub enum Source {
    File(PathBuf, ParserType),
    Stream(Transport, ParserType),
}
