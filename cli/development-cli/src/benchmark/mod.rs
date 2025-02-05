//! Manages benchmarks commands to run the given benchmark or list all of the available ones.

mod core;

use clap::Subcommand;

#[derive(Debug, Clone, Subcommand)]
/// Represents benchmarks commands to run the given benchmark or list all of the available ones.
pub enum BenchTarget {
    /// Run benchmarks in Rust Core
    Core {
        /// Name of the benchmark as stated in configurations file.
        #[arg(index = 1, required = true)]
        name: String,

        /// Path or configurations of the input source to be used in the benchmarks
        #[arg(short, long = "input")]
        input_source: Option<String>,

        /// Additional configurations for the benchmarks
        #[arg(short, long)]
        config: Option<String>,

        /// Determines how many times to run the benchmark.
        #[arg(short, long, default_value = "1")]
        run_count: u8,

        /// Sets sample size on criterion benchmarks
        #[arg(short, long)]
        sample_size: Option<usize>,
    },
    /// Lists all the available benchmarks in configuration files.
    List,
}

impl BenchTarget {
    /// Runs the operations defined by each [`BenchTarget`]
    pub fn run(self) -> anyhow::Result<()> {
        match self {
            BenchTarget::Core {
                name,
                input_source,
                config,
                run_count,
                sample_size,
            } => {
                core::run_benchmark(name, input_source, config, run_count, sample_size)?;
            }
            BenchTarget::List => {
                println!("Listing all benchmarks from configurations...");
                println!();

                let core = core::ConfigsInfos::load()?;
                core.print_list();
                println!();
            }
        }

        Ok(())
    }
}
