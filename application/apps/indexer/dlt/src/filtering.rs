// Copyright (c) 2019 E.S.R.Labs. All rights reserved.
//
// NOTICE:  All information contained herein is, and remains
// the property of E.S.R.Labs and its suppliers, if any.
// The intellectual and technical concepts contained herein are
// proprietary to E.S.R.Labs and its suppliers and may be covered
// by German and Foreign Patents, patents in process, and are protected
// by trade secret or copyright law.
// Dissemination of this information or reproduction of this material
// is strictly forbidden unless prior written permission is obtained
// from E.S.R.Labs.
use crate::dlt;
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, io::Read, iter::FromIterator};

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
#[derive(Clone)]
pub struct ProcessedDltFilterConfig {
    pub min_log_level: Option<dlt::LogLevel>,
    pub app_ids: Option<HashSet<String>>,
    pub ecu_ids: Option<HashSet<String>>,
    pub context_ids: Option<HashSet<String>>,
}

pub fn process_filter_config(cfg: DltFilterConfig) -> ProcessedDltFilterConfig {
    ProcessedDltFilterConfig {
        min_log_level: cfg.min_log_level.and_then(dlt::u8_to_log_level),
        app_ids: cfg.app_ids.map(HashSet::from_iter),
        ecu_ids: cfg.ecu_ids.map(HashSet::from_iter),
        context_ids: cfg.context_ids.map(HashSet::from_iter),
    }
}

pub fn read_filter_options(f: &mut fs::File) -> Result<DltFilterConfig, failure::Error> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)?;
    let v: DltFilterConfig = serde_json::from_str(&contents[..])?;
    Ok(v)
}
