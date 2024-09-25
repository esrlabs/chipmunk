use std::fs::read_to_string;

use anyhow::{ensure, Context};
use serde::Deserialize;

use crate::location::config_path;

/// Filename for rust core benchmarks configurations.
pub const CONFIG_FILENAME: &str = "bench_core.toml";

#[derive(Debug, Clone, Deserialize)]
/// Configurations info for rust core benchmarks.
pub struct ConfigsInfos {
    #[serde(rename = "bench")]
    benches: Vec<BenchmarkInfo>,
}

impl ConfigsInfos {
    /// Loads benchmarks infos from configuration file.
    pub fn load() -> anyhow::Result<Self> {
        let config_file_path = config_path().join(CONFIG_FILENAME);
        ensure!(
            config_file_path.exists(),
            "Configuration file doesn't exist. Path: {}",
            config_file_path.display()
        );

        let content = read_to_string(&config_file_path).with_context(|| {
            format!(
                "Error while reading configuration file. Path: {}",
                config_file_path.display()
            )
        })?;

        let config = toml::from_str(&content).with_context(|| {
            format!(
                "Error while parsing configuration file. Path: {}",
                config_file_path.display()
            )
        })?;

        Ok(config)
    }

    /// Prints the benchmarks infos from the configuration file.
    pub fn print_list(&self) {
        println!("Target Rust Core:");
        for (idx, bench) in self.benches.iter().enumerate() {
            if idx > 0 {
                println!("  --------------------");
            }
            println!("  Benchmark: {}", bench.name);
            println!("  Library: {}", bench.library);
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
/// Infos for a benchmark in rust core.
pub struct BenchmarkInfo {
    /// Name of the benchmark as defined in `Cargo.toml` file.
    name: String,
    /// Library name where the benchmark is defined.
    /// It represents the relative path of this library starting from rust core main path `.../indexer`.
    library: String,
}

pub fn run_benchmark(name: String, input_source: String, config: Option<String>, run_count: u8) {
    todo!()
}
