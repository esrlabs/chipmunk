use serde::{Deserialize, Serialize};
use std::io::{Read};
use std::fs;

#[derive(Serialize, Deserialize, Debug)]
pub struct DltFilterConfig {
    pub min_log_level: Option<u8>,
    pub components: Option<Vec<String>>,
}

/// only select log entries with level MIN_LEVEL and more severe
///  1 => FATAL
///  2 => ERROR
///  3 => WARN
///  4 => INFO
///  5 => DEBUG
///  6 => VERBOSE
pub fn read_filter_options(f: &mut fs::File) -> Result<DltFilterConfig, failure::Error> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)
        .expect("something went wrong reading the file");
    let v: DltFilterConfig = serde_json::from_str(&contents[..])?;
    Ok(v)
}
