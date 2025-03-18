//! Provide the types and the definitions for the command line arguments.

use std::{fmt::Display, path::PathBuf};

use anyhow::ensure;
use clap::Subcommand;

use crate::session::format::text::{
    OUTPUT_ARGS_SEPARATOR_DEFAULT, OUTPUT_COLUMNS_SEPARATOR_DEFAULT,
};

const HELP_TEMPLATE: &str = "\
{before-help}{about}
version: {version}

{usage-heading} {usage}

{all-args}{after-help}
";

#[derive(clap::Parser, Debug)]
#[command(author, version, about, help_template = HELP_TEMPLATE)]
pub struct Cli {
    /// Specify the path for the output file.
    #[arg(short, long = "output", required = true)]
    pub output_path: PathBuf,
    /// Specify the format of the output.
    #[arg(short = 'f', long, default_value_t = OutputFormat::Binary)]
    pub output_format: OutputFormat,
    /// Appends to the output file if it exists, rather than returning an error.
    #[arg(short, long, default_value_t = false)]
    pub append_output: bool,
    /// Sets the column separator for parsed data in text output.
    #[arg(long = "cols-sep", default_value_t = String::from(OUTPUT_COLUMNS_SEPARATOR_DEFAULT))]
    pub text_columns_separator: String,
    /// Sets the argument separator for payload column in text output.
    #[arg(long = "args-sep", default_value_t = String::from(OUTPUT_ARGS_SEPARATOR_DEFAULT))]
    pub text_args_separator: String,
    /// Specifies the parser to use for incoming bytes.
    #[command(subcommand)]
    pub parser: Parser,
}

#[derive(Debug, Clone, Subcommand)]
pub enum Parser {
    /// Establishes a DLT session using the configured parser.
    Dlt {
        /// The paths to the FIBEX files used for this parsing session.
        #[arg(short, long)]
        fibex_files: Vec<PathBuf>,
        #[command(subcommand)]
        input: InputSource,
    },
}

impl Display for Parser {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Parser::Dlt { .. } => write!(f, "Dlt"),
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
        /// Time interval (in seconds) to print current status.
        #[arg(short, long = "update-interval", default_value_t = 5)]
        update_interval: u64,
        /// Maximum number of reconnection attempts if the connection is lost.
        /// Value must be set to enable automatic reconnect to server.
        #[arg(short, long = "max-reconnect", verbatim_doc_comment)]
        max_reconnect_count: Option<usize>,
        /// Time interval (in seconds) between reconnection attempts.
        #[arg(short, long = "reconnect-interval", default_value_t = 1)]
        reconnect_interval: u64,
        /// Time interval (in seconds) to send `keep-alive` probes to TCP server.
        /// Value must be set to enable `keep-alive` on the server.
        #[arg(short, long = "keep-alive", verbatim_doc_comment)]
        keep_alive: Option<u64>,
    },
    /// Establish a UDP connection using the specified IP address as the input source.
    Udp {
        /// The address to bind the connection to.
        #[arg(index = 1)]
        address: String,
        /// Time interval (in seconds) to print current status.
        #[arg(short, long = "update-interval", default_value_t = 5)]
        update_interval: u64,
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
        // We are using pattern matching here as reminder to check the validation on each change
        // in the CLI arguments.
        let Self {
            output_path,
            output_format,
            append_output,
            text_columns_separator: _,
            text_args_separator: _,
            parser,
        } = self;

        Self::validate_output_format(output_format)?;

        ensure!(
            *append_output || !output_path.exists(),
            "Output file already exist. Path: {}\n\
             Note: You can append to the output file by enabling the `append-output` flag.",
            output_path.display()
        );

        match parser {
            Parser::Dlt { fibex_files, input } => {
                for fibex in fibex_files {
                    ensure!(
                        fibex.exists(),
                        "Following fibex path doesn't exist. Path: {}",
                        fibex.display()
                    );
                    ensure!(
                        fibex.is_file(),
                        "Following fibex path is not a file. Path: {}",
                        fibex.display()
                    );
                }

                Self::validate_input_source(input)?;
            }
        }

        Ok(())
    }

    fn validate_input_source(input: &InputSource) -> anyhow::Result<()> {
        match input {
            InputSource::Tcp {
                address: _,
                update_interval,
                max_reconnect_count: _,
                reconnect_interval: interval_reconnect,
                keep_alive,
            } => {
                ensure!(
                    *update_interval > 0,
                    "Update interval must be greater than zero"
                );
                ensure!(
                    *interval_reconnect > 0,
                    "Reconnect interval must be grater than zero"
                );
                ensure!(
                    keep_alive.is_none_or(|v| v > 0),
                    "Keepalive time must be greater than zero when set"
                );
            }
            InputSource::Udp {
                address: _,
                update_interval,
            } => {
                ensure!(
                    *update_interval > 0,
                    "Update interval must be greater than zero"
                );
            }
            InputSource::File { path } => {
                ensure!(
                    path.exists(),
                    "Input file doesn't exit. Path: {}",
                    path.display()
                );
            }
        }

        Ok(())
    }

    fn validate_output_format(output_format: &OutputFormat) -> anyhow::Result<()> {
        // Reminder to check validation on new output formats.
        match output_format {
            OutputFormat::Binary => {}
            OutputFormat::Text => {}
        };

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Ensure the CLI configurations are valid.
    #[test]
    fn verify_cli() {
        use clap::CommandFactory;
        Cli::command().debug_assert();
    }
}
