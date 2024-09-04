use indexer_base::config::MulticastInfo;
use parsers::dlt;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf};
use uuid::Uuid;

use crate::plugins::PluginParserSettings;

#[allow(clippy::large_enum_variant)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ParserType {
    Plugin(PluginParserSettings),
    Dlt(DltParserSettings),
    SomeIp(SomeIpParserSettings),
    Text,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DltParserSettings {
    pub filter_config: Option<dlt::DltFilterConfig>,
    pub fibex_file_paths: Option<Vec<String>>,
    pub with_storage_header: bool,
    pub tz: Option<String>,
    #[serde(skip)]
    pub fibex_metadata: Option<dlt::FibexMetadata>,
}

impl Default for DltParserSettings {
    fn default() -> Self {
        Self {
            filter_config: None,
            fibex_file_paths: None,
            with_storage_header: true,
            tz: None,
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
            tz: None,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SomeIpParserSettings {
    pub fibex_file_paths: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Transport {
    Process(ProcessTransportConfig),
    TCP(TCPTransportConfig),
    UDP(UDPTransportConfig),
    Serial(SerialTransportConfig),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessTransportConfig {
    pub cwd: PathBuf,
    pub command: String,
    pub envs: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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
pub struct TCPTransportConfig {
    pub bind_addr: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UDPTransportConfig {
    pub bind_addr: String,
    pub multicast: Vec<MulticastInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum FileFormat {
    PcapNG,
    PcapLegacy,
    Text,
    Binary,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ObserveOrigin {
    File(String, FileFormat, PathBuf),
    Concat(Vec<(String, FileFormat, PathBuf)>),
    Stream(String, Transport),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ObserveOptions {
    pub origin: ObserveOrigin,
    pub parser: ParserType,
}

impl ObserveOptions {
    pub fn file(filename: PathBuf, file_origin: FileFormat, parser: ParserType) -> Self {
        ObserveOptions {
            origin: ObserveOrigin::File(Uuid::new_v4().to_string(), file_origin, filename),
            parser,
        }
    }
}
