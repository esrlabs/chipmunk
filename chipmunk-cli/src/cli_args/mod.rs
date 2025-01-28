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
    pub parser: Parser,
    #[command(subcommand)]
    pub input: InputSource,
    /// Specify an optional path for the output. In case no file is set the output will be printed
    /// to stdout.
    #[arg(short, long)]
    pub output: Option<PathBuf>,
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
    /// Open TCP connection with the provided IP as input source.
    Tcp {
        // #[arg(short, long)]
        #[arg(index = 1)]
        ip: String,
    },
    /// Open UDP connection with the provided IP as input source.
    Udp {
        // #[arg(short, long)]
        #[arg(index = 1)]
        ip: String,
    },
    /// Open the file with the provided path as input source.
    File {
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
