#![allow(unused)]

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use stypes::{PluginConfigItem, PluginConfigValue};

// Note:
// Rust LSP may mark this as an error, but this is an issue with the LSP itself.
// The code will compile without problems.

#[path = "./../../sources/benches/bench_utls.rs"]
mod bench_utls;

/// Represents the needed configuration to run benchmarks on a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginBenchConfig {
    /// The path for the plugin WASM file.
    pub binary_path: PathBuf,
    /// Configurations needed by the plugins.
    pub config: Vec<PluginConfigItem>,
}

/// Retrieve plugin path and configurations from configuration path.
///
/// # Note:
///
/// This function expects to get the path for the plugin configurations `toml` file
/// via bench configuration environment variable.
pub fn get_plugin_config() -> PluginBenchConfig {
    let config_path = bench_utls::get_config()
        .map(PathBuf::from)
        .expect("Path to plugin config must be provided as additional config");
    assert!(config_path.exists(), "Config files doesn't exist");
    let config_content =
        std::fs::read_to_string(config_path).expect("Read plugin config file falied");

    toml::from_str(&config_content).expect("Deserializing plugin config failed")
}

/// Provides the default configurations of string parser plugin hard-coded.
pub fn get_string_parser_configs() -> Vec<PluginConfigItem> {
    const LOSSY_ID: &str = "lossy";
    const PREFIX_ID: &str = "prefix";
    vec![
        PluginConfigItem::new(LOSSY_ID, PluginConfigValue::Boolean(false)),
        PluginConfigItem::new(PREFIX_ID, PluginConfigValue::Text(String::default())),
    ]
}

/// Provides the default configurations of dlt parser plugin hard-coded.
pub fn get_dlt_parser_configs() -> Vec<PluginConfigItem> {
    const LOG_LEVEL_ID: &str = "log_level";
    const FIBEX_ID: &str = "fibex_id";
    const STORAGE_HEADER_ID: &str = "storage_header_id";
    vec![
        PluginConfigItem::new(LOG_LEVEL_ID, PluginConfigValue::Dropdown("Verbose".into())),
        PluginConfigItem::new(FIBEX_ID, PluginConfigValue::Files(Vec::new())),
        PluginConfigItem::new(STORAGE_HEADER_ID, PluginConfigValue::Boolean(true)),
    ]
}
