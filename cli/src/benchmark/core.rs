//! Manages benchmarks commands for rust core target.

use std::fs::read_to_string;

use anyhow::{ensure, Context};
use console::style;
use serde::Deserialize;

use crate::{location::config_path, log_print::print_log_separator, target::Target};

/// Filename for rust core benchmarks configurations.
pub const CONFIG_FILENAME: &str = "bench_core.toml";

/// Environment variables to pass input source to benchmarks.
pub const INPUT_SOURCE_ENV_VAR: &str = "CHIPMUNK_BENCH_SOURCE";
/// Environment variables to pass configurations to benchmarks.
pub const CONFIG_ENV_VAR: &str = "CHIPMUNK_BENCH_CONFIG";

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

pub fn run_benchmark(
    name: String,
    input_source: Option<String>,
    additional_config: Option<String>,
    run_count: u8,
) -> anyhow::Result<()> {
    let config_info = ConfigsInfos::load()?;
    let bench = config_info
        .benches
        .into_iter()
        .find(|b| b.name == name)
        .with_context(|| format!("Benchmark with the name '{name}' is not defined"))?;

    let cwd = Target::Core.cwd().join(bench.library);
    let cmd = format!("cargo bench --bench {}", bench.name);

    for i in 0..run_count {
        if i > 0 {
            print_log_separator();
        }

        let msg = format!("Running benchmark {name} for the {} time...", i + 1);
        println!("{}\n", style(msg).bold().blue());

        //TODO AAZ: Use the unified function for creating command once their PR is merged.
        let mut command = if cfg!(target_os = "windows") {
            let mut cmd = std::process::Command::new("cmd");
            cmd.arg("/C");
            cmd
        } else {
            let mut cmd = std::process::Command::new("sh");
            cmd.arg("-c");
            cmd
        };

        command.arg(&cmd);

        if let Some(input) = &input_source {
            command.env(INPUT_SOURCE_ENV_VAR, input);
        }

        if let Some(config) = &additional_config {
            command.env(CONFIG_ENV_VAR, config);
        }

        command.current_dir(&cwd);

        let status = command
            .status()
            .with_context(|| format!("Error while running bench command: {cmd}"))?;

        ensure!(status.success(), "Benchmark command failed. Command: {cmd}");
    }

    Ok(())
}
