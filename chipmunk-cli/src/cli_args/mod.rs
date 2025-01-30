use std::{fmt::Display, path::PathBuf};

use clap::Subcommand;

use crate::session::format::{TEXT_ARGS_SEPARATOR_DEFAULT, TEXT_COLUMS_SEPARATOR_DEFAULT};

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
    /// Specify the format of the output.
    #[arg(short = 'f', long, default_value_t = OutputFormat::Binary)]
    pub output_format: OutputFormat,
    /// Specify the parser type to use in parsing the incoming bytes.
    #[arg(short, long, value_enum, default_value_t = Parser::Dlt)]
    pub parser: Parser,
    /// Specify the separator between the columns of parsed data in text output format.
    #[arg(long = "cols-sep", default_value_t = String::from(TEXT_COLUMS_SEPARATOR_DEFAULT))]
    pub text_colmuns_separator: String,
    /// Specify the separator between the arguments of the payload columns in parsed data
    /// in text output format.
    #[arg(long = "args-sep", default_value_t = String::from(TEXT_ARGS_SEPARATOR_DEFAULT))]
    pub text_args_separator: String,
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

#[derive(Debug, Clone, Copy, clap::ValueEnum)]
pub enum OutputFormat {
    /// Output in binary format.
    Binary,
    /// Parsed output as text.
    Text,
}

impl Display for OutputFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OutputFormat::Binary => write!(f, "binary"),
            OutputFormat::Text => write!(f, "text"),
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
        /// Time interval (in milliseconds) to print current status.
        #[arg(short, long = "update-interval", default_value_t = 5000)]
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
