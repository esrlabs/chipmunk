mod core;

use clap::Subcommand;

#[derive(Debug, Clone, Subcommand)]
pub enum BenchTarget {
    /// Run benchmarks in Rust Core
    Core {
        /// Name of the benchmark as stated in configurations file.
        #[arg(index = 1, required = true)]
        name: String,

        /// Path of configs of the input source to be used in the benchmarks
        #[arg(index = 2, required = true)]
        input_source: String,

        /// Additional configurations for the benchmarks
        #[arg(short, long)]
        config: Option<String>,

        /// Determines how many times to run the benchmark.
        #[arg(short, long, default_value = "1")]
        run_count: u8,
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
            } => {
                //TODO AAZ: Remove debug code after done.
                println!("Name: {}", name);
                println!("Input: {}", input_source);
                println!("Config: {:?}", config);
                println!("Run Count: {:?}", run_count);

                core::run_benchmark(name, input_source, config, run_count)
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
