use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParserType {
    Dlt,
    Pcap,
    // Dlt(DltParserSettings),
    // Pcap(PcapParserSettings),
    SomeIP(SomeIPParserSettings),
    Text,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DltParserSettings {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PcapParserSettings {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SomeIPParserSettings {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Transport {
    Process(ProcessTransportConfig),
    TCP(ProcessTransportConfig),
    UDP(UDPTransportConfig),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessTransportConfig {
    pub cmd: PathBuf,
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TCPTransportConfig {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UDPTransportConfig {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Source {
    File(PathBuf, ParserType),
    Stream(Transport, ParserType),
}
