use parsers::dlt;
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParserType {
    Dlt(DltParserSettings),
    Pcap(PcapParserSettings),
    SomeIP(SomeIPParserSettings),
    Text,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DltParserFilterConfig {
    // pub min_log_level: Option<dlt::LogLevel>,
    pub app_ids: Option<HashSet<String>>,
    pub ecu_ids: Option<HashSet<String>>,
    pub context_ids: Option<HashSet<String>>,
    pub app_id_count: i64,
    pub context_id_count: i64,
}

impl DltParserFilterConfig {
    pub fn get(&self) -> dlt::ProcessedDltFilterConfig {
        dlt::ProcessedDltFilterConfig {
            //min_log_level: self.min_log_level,
            min_log_level: None,
            app_ids: self.app_ids.clone(),
            ecu_ids: self.ecu_ids.clone(),
            context_ids: self.context_ids.clone(),
            app_id_count: self.app_id_count,
            context_id_count: self.context_id_count,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DltParserSettings {
    pub filter_config: Option<DltParserFilterConfig>,
    pub fibex_file_paths: Option<Vec<String>>,
    pub with_storage_header: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PcapParserSettings {
    pub dlt: DltParserSettings,
}

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
