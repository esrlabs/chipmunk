use std::{fmt::Display, path::PathBuf};

use clap::Subcommand;

const HELP_TEMPLATE: &str = "\
{before-help}{about}
version: {version}

{usage-heading} {usage}

{all-args}{after-help}
";

#[derive(clap::Parser, Debug)]
#[command(author, version, about, help_template = HELP_TEMPLATE)]
pub struct Cli {
    /// Specify an path for the output file.
    #[arg(short, long, required = true)]
    pub output: PathBuf,
    /// Specify the parser type to use in parsing the incoming bytes.
    #[arg(short, long, value_enum, default_value_t= Parser::Dlt)]
    pub parser: Parser,
    #[command(subcommand)]
    pub input: InputSource,
}

#[derive(Debug, Clone, Copy, clap::ValueEnum)]
pub enum Parser {
    /// Dlt Parser.
    Dlt,
}

impl Display for Parser {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Parser::Dlt => write!(f, "Dlt"),
        }
    }
}

#[derive(Debug, Clone, Subcommand)]
pub enum InputSource {
    /// Establish a TCP connection using the specified IP address as the input source.
    Tcp {
        /// The address to bind the connection to.
        #[arg(index = 1)]
        address: String,
        // Time interval (in milliseconds) to print current status.
        #[arg(short, long = "interval-reconnect", default_value_t = 5000)]
        update_interval: u64,
        /// Maximum number of reconnection attempts if the connection is lost.
        #[arg(short, long = "max-reconnect")]
        max_reconnect_count: Option<usize>,
        /// Time interval (in milliseconds) between reconnection attempts.
        #[arg(short, long = "interval-reconnect", default_value_t = 1000)]
        interval_reconnect: u64,
    },
    /// Establish a UDP connection using the specified IP address as the input source.
    Udp {
        /// The address to bind the connection to.
        #[arg(index = 1)]
        address: String,
    },
    /// Read input from a file at the specified path.
    File {
        /// Path to the input file.
        #[arg(index = 1)]
        path: PathBuf,
    },
}

impl Cli {
    pub fn validate(&self) -> anyhow::Result<()> {
        //TODO AAZ: Make sure we need validation here.
        Ok(())
    }
}
