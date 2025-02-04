//! Manages benchmarks commands for rust core target.

use std::{borrow::Cow, ffi::OsStr, fs::read_to_string, path::PathBuf};

use anyhow::{ensure, Context};
use console::style;
use serde::Deserialize;

use crate::{
    location::config_path, log_print::print_log_separator, shell::shell_std_command, target::Target,
};

/// Filename for rust core benchmarks configurations.
pub const CONFIG_FILENAME: &str = "bench_core.toml";

/// Environment variables to pass input source to benchmarks.
pub const INPUT_SOURCE_ENV_VAR: &str = "CHIPMUNK_BENCH_SOURCE";
/// Environment variables to pass configurations to benchmarks.
pub const CONFIG_ENV_VAR: &str = "CHIPMUNK_BENCH_CONFIG";
/// Environment variables to pass sample size to benchmarks.
pub const SAMPLE_SIZE_ENV_VAR: &str = "CHIPMUNK_BENCH_SAMPLE_SIZE";

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
            "Benchmarks Configuration file doesn't exist. Path: {}",
            config_file_path.display()
        );

        let content = read_to_string(&config_file_path).with_context(|| {
            format!(
                "Error while reading benchmarks configuration file. Path: {}",
                config_file_path.display()
            )
        })?;

        let config = toml::from_str(&content).with_context(|| {
            format!(
                "Error while parsing benchmarks configuration file. Path: {}",
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
    sample_size: Option<usize>,
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

        let msg = if run_count > 1 {
            format!("Running benchmark {name} for the {} time...", i + 1)
        } else {
            format!("Running benchmark {name}...")
        };

        println!("{}\n", style(msg).bold().blue());

        let mut command = shell_std_command();
        command.arg(&cmd);

        if let Some(input) = input_source.as_deref() {
            // Assuming that the input can be a path for a file in most cases, we need to resolve
            // it and provide the absolute path before changing the current directory when running
            // the benchmark command.
            let input = resolve_if_path(input);
            command.env(INPUT_SOURCE_ENV_VAR, input);
        }

        if let Some(config) = additional_config.as_deref() {
            // Same Case as input source above
            let config = resolve_if_path(config);
            command.env(CONFIG_ENV_VAR, config);
        }

        if let Some(sample_size) = sample_size {
            command.env(SAMPLE_SIZE_ENV_VAR, sample_size.to_string());
        }

        command.current_dir(&cwd);

        let status = command
            .status()
            .with_context(|| format!("Error while running bench command: {cmd}"))?;

        ensure!(status.success(), "Benchmark command failed. Command: {cmd}");
    }

    Ok(())
}

/// Resolves a relative path to its absolute path if the given argument is a valid path
/// in the current directory returning the absolute path in that case, otherwise it'll
/// return the same argument back.
///
/// This function is needed to resolve the relative paths before changing the current directory
/// while running the benchmark commands.
fn resolve_if_path(arg: &str) -> Cow<OsStr> {
    let potential_path = PathBuf::from(&arg);
    if potential_path.exists() {
        if let Ok(path) = std::path::absolute(potential_path) {
            return Cow::Owned(path.into_os_string());
        }
    }

    Cow::Borrowed(arg.as_ref())
}
