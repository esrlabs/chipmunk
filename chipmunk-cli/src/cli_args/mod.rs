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
    /// Specify the parser type to use in parsing the incoming bytes.
    #[arg(short, long, value_enum, default_value_t= Parser::Dlt)]
    parser: Parser,
    #[command(subcommand)]
    input: InputSource,
    /// Specify an optional path for the output. In case no file is set the output will be printed
    /// to stdout.
    #[arg(short, long)]
    output: Option<PathBuf>,
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
    /// Input as TCP connection with the provided IP.
    Tcp {
        #[arg(short, long)]
        ip: String,
    },
    /// Input as UDP connection with the provided IP.
    Udp {
        #[arg(short, long)]
        ip: String,
    },
    /// Input as File with the provided path.
    File {
        #[arg(short, long)]
        path: PathBuf,
    },
}
