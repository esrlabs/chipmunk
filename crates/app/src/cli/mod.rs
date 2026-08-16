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
#[clap(
    name = "chipmunk",
    version,
    about,
    help_template = HELP_TEMPLATE,
    // Generated usage would read `chipmunk [PATHS]... [COMMAND]`, which suggests paths
    // and a command can be combined. Spell the two accepted forms out instead.
    override_usage = "chipmunk [COMMAND]\n       chipmunk <PATHS>..."
)]
pub struct Cli {
    #[command(subcommand)]
    pub source: Option<SourcesCommand>,
    // clap has no default subcommand. These top-level paths stand in for `files`,
    // which is how the OS launches Chipmunk when a file is opened with it.
    /// Paths to the source files. Shorthand for the `files` command.
    #[arg(name = "PATHS", value_hint = ValueHint::FilePath)]
    pub paths: Vec<PathBuf>,
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
    pub fn get_commands(self) -> Vec<CliCommand> {
        let Self { source, paths } = self;

        // Bare paths are the shorthand form of the `files` command.
        let source = match (source, paths) {
            (Some(source), _) => Some(source),
            (None, paths) if !paths.is_empty() => Some(SourcesCommand::Files { paths }),
            (None, _) => None,
        };

        let mut cli_cmds = Vec::new();

        if let Some(source) = source {
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

    use clap::Parser;

    /// Ensure the CLI configurations are valid.
    #[test]
    fn verify_cli() {
        use clap::CommandFactory;
        Cli::command().debug_assert();
    }

    fn parse(args: &[&str]) -> Vec<CliCommand> {
        Cli::try_parse_from(args).unwrap().get_commands()
    }

    #[test]
    fn no_args_has_no_commands() {
        assert!(parse(&["chipmunk"]).is_empty());
    }

    #[test]
    fn bare_paths_open_files() {
        let cmds = parse(&["chipmunk", "a.log", "b.dlt"]);
        assert!(matches!(
            cmds.as_slice(),
            [CliCommand::OpenFiles { paths }] if paths == &[PathBuf::from("a.log"), PathBuf::from("b.dlt")]
        ));
    }

    #[test]
    fn files_command_still_works() {
        let cmds = parse(&["chipmunk", "files", "a.log", "b.dlt"]);
        assert!(matches!(
            cmds.as_slice(),
            [CliCommand::OpenFiles { paths }] if paths == &[PathBuf::from("a.log"), PathBuf::from("b.dlt")]
        ));
    }

    /// A file named like a subcommand still reaches the app after `--`.
    #[test]
    fn escaped_path_is_not_a_subcommand() {
        let cmds = parse(&["chipmunk", "--", "files"]);
        assert!(matches!(
            cmds.as_slice(),
            [CliCommand::OpenFiles { paths }] if paths == &[PathBuf::from("files")]
        ));
    }

    #[test]
    fn files_command_requires_paths() {
        assert!(Cli::try_parse_from(["chipmunk", "files"]).is_err());
    }

    /// Once the first path is taken, later values stay paths and never start a subcommand.
    #[test]
    fn subcommand_name_after_path_is_a_path() {
        let cmds = parse(&["chipmunk", "a.log", "files"]);
        assert!(matches!(
            cmds.as_slice(),
            [CliCommand::OpenFiles { paths }] if paths == &[PathBuf::from("a.log"), PathBuf::from("files")]
        ));
    }
}
