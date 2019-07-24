use serde::{Deserialize, Serialize};
use std::io::{Read};
use std::fs;
use std::collections::HashSet;
use crate::dlt;
use std::iter::FromIterator;

/// only select log entries with level MIN_LEVEL and more severe
///  1 => FATAL
///  2 => ERROR
///  3 => WARN
///  4 => INFO
///  5 => DEBUG
///  6 => VERBOSE
#[derive(Serialize, Deserialize, Debug)]
pub struct DltFilterConfig {
    pub min_log_level: Option<u8>,
    pub app_ids: Option<Vec<String>>,
    pub ecu_ids: Option<Vec<String>>,
    pub context_ids: Option<Vec<String>>,
}
pub struct ProcessedDltFilterConfig {
    pub min_log_level: Option<dlt::LogLevel>,
    pub app_ids: Option<HashSet<String>>,
    pub ecu_ids: Option<HashSet<String>>,
    pub context_ids: Option<HashSet<String>>,
}

pub fn process_filter_config(cfg: DltFilterConfig) -> ProcessedDltFilterConfig {
    ProcessedDltFilterConfig {
        min_log_level: cfg.min_log_level.and_then(dlt::u8_to_log_level),
        app_ids: cfg
            .app_ids
            .and_then(|cmp_list| Some(HashSet::from_iter(cmp_list))),
        ecu_ids: cfg.ecu_ids.and_then(|ecus| Some(HashSet::from_iter(ecus))),
        context_ids: cfg
            .context_ids
            .and_then(|ids| Some(HashSet::from_iter(ids))),
    }
}

pub fn read_filter_options(f: &mut fs::File) -> Result<DltFilterConfig, failure::Error> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)
        .expect("something went wrong reading the file");
    let v: DltFilterConfig = serde_json::from_str(&contents[..])?;
    Ok(v)
}
