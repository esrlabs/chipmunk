use indexer_base::config::MulticastInfo;
use parsers::dlt;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf};
use uuid::Uuid;

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
    #[serde(skip)]
    pub fibex_metadata: Option<dlt::FibexMetadata>,
}

impl Default for DltParserSettings {
    fn default() -> Self {
        Self {
            filter_config: None,
            fibex_file_paths: None,
            with_storage_header: true,
            fibex_metadata: None,
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
            fibex_metadata: None,
        }
    }

    pub fn load_fibex_metadata(&mut self) {
        if self.fibex_metadata.is_some() {
            return;
        }
        self.fibex_metadata = if let Some(paths) = self.fibex_file_paths.as_ref() {
            dlt::gather_fibex_data(dlt::FibexConfig {
                fibex_file_paths: paths.clone(),
            })
        } else {
            None
        };
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
    TCP(TCPTransportConfig),
    UDP(UDPTransportConfig),
    Serial(SerialTransportConfig),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessTransportConfig {
    pub cwd: PathBuf,
    pub command: String,
    pub args: Vec<String>,
    pub envs: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SerialTransportConfig {
    pub path: String,
    pub baud_rate: u32,
    pub data_bits: u8,
    pub flow_control: u8,
    pub parity: u8,
    pub stop_bits: u8,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TCPTransportConfig {
    pub bind_addr: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UDPTransportConfig {
    pub bind_addr: String,
    pub multicast: Vec<MulticastInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ObserveOrigin {
    File(String, PathBuf),
    Concat(Vec<(String, PathBuf)>),
    Stream(String, Transport),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ObserveOptions {
    pub origin: ObserveOrigin,
    pub parser: ParserType,
}

impl ObserveOptions {
    pub fn file(filename: PathBuf, parser: ParserType) -> Self {
        ObserveOptions {
            origin: ObserveOrigin::File(Uuid::new_v4().to_string(), filename),
            parser,
        }
    }
}
