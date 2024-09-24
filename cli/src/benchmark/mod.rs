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

        /// Determines how many times to repeat the benchmark.
        #[arg(short, long)]
        repeat: Option<u8>,
    },
    /// Lists all the available benchmarks in configuration files.
    List,
}

impl BenchTarget {
    pub fn run(self) -> anyhow::Result<()> {
        match self {
            BenchTarget::Core {
                name,
                input_source,
                config,
                repeat,
            } => {
                println!("name: {}", name);
                println!("input: {}", input_source);
                println!("config: {:?}", config);
                println!("Repeat: {:?}", repeat);
            }
            BenchTarget::List => println!(" List Called"),
        }

        Ok(())
    }
}
