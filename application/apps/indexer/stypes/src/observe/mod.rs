#[cfg(any(test, feature = "nodejs"))]
mod nodejs;

use crate::*;
use dlt_core::filtering::DltFilterConfig;

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct MulticastInfo {
    pub multiaddr: String,
    pub interface: Option<String>,
}

#[allow(clippy::large_enum_variant)]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub enum ParserType {
    Dlt(DltParserSettings),
    SomeIp(SomeIpParserSettings),
    Text(()),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct DltParserSettings {
    pub filter_config: Option<DltFilterConfig>,
    pub fibex_file_paths: Option<Vec<String>>,
    pub with_storage_header: bool,
    pub tz: Option<String>,
    #[serde(skip)]
    pub fibex_metadata: Option<dlt_core::fibex::FibexMetadata>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct SomeIpParserSettings {
    pub fibex_file_paths: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub enum Transport {
    Process(ProcessTransportConfig),
    TCP(TCPTransportConfig),
    UDP(UDPTransportConfig),
    Serial(SerialTransportConfig),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct ProcessTransportConfig {
    pub cwd: PathBuf,
    pub command: String,
    pub envs: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct SerialTransportConfig {
    pub path: String,
    pub baud_rate: u32,
    pub data_bits: u8,
    pub flow_control: u8,
    pub parity: u8,
    pub stop_bits: u8,
    pub send_data_delay: u8,
    pub exclusive: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct TCPTransportConfig {
    pub bind_addr: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[extend::encode_decode]
pub struct UDPTransportConfig {
    pub bind_addr: String,
    pub multicast: Vec<MulticastInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub enum FileFormat {
    PcapNG,
    PcapLegacy,
    Text,
    Binary,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub enum ObserveOrigin {
    File(String, FileFormat, PathBuf),
    Concat(Vec<(String, FileFormat, PathBuf)>),
    Stream(String, Transport),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct ObserveOptions {
    pub origin: ObserveOrigin,
    pub parser: ParserType,
}
