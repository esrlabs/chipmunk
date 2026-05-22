use std::path::PathBuf;

mod command;

use clap::{Subcommand, ValueHint};
pub use command::CliCommand;

const HELP_TEMPLATE: &str = "\
{before-help}{about}
version: {version}

{usage-heading} {usage}

{all-args}{after-help}
";

#[derive(Debug, clap::Parser)]
#[clap(name = "chipmunk", version, about, help_template = HELP_TEMPLATE)]
pub struct Cli {
    #[command(subcommand)]
    pub source: Option<SourcesCommand>,
}

#[derive(Debug, Clone, Subcommand)]
pub enum SourcesCommand {
    /// Open file(s) in new session(s).
    Files {
        /// Paths to the source files.
        #[arg(index = 1, name = "PATHS", required = true, value_hint = ValueHint::FilePath)]
        paths: Vec<PathBuf>,
    },
    /// Execute shell command in new session.
    #[clap(visible_alias = "command")]
    Process {
        #[arg(index = 1, name = "COMMAND", required = true, value_hint = ValueHint::DirPath)]
        /// Command to run.
        command: String,
        #[arg(long)]
        /// Current working directory
        cwd: Option<PathBuf>,
    },
}

impl Cli {
    pub fn get_commands(mut self) -> Vec<CliCommand> {
        let mut cli_cmds = Vec::new();

        if let Some(source) = self.source.take() {
            let cmd = match source {
                SourcesCommand::Files { paths } => CliCommand::OpenFiles { paths },
                SourcesCommand::Process { command, cwd } => {
                    CliCommand::ProcessCommand { command, cwd }
                }
            };
            cli_cmds.push(cmd);
        }

        cli_cmds
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
