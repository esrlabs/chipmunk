use std::path::PathBuf;

use clap::{Parser, Subcommand};

use crate::target::Target;

const REPORT_HELP_TEXT: &str =
    "Write report from command logs to the given file or to stdout if no file is defined.";
const REPORT_VALUE_NAME: &str = "FILE-PATH";
const FAIL_FAST_HELP_TEXT: &str = "Stops execution immediately if any job fails.";
const NO_UI_HELP_TEXT: &str = "Disable UI progress bars and output each job's logs directly to stdout as soon as it's completed";

#[derive(Parser)]
#[command(name = "cargo", bin_name = "cargo")]
pub enum CargoCli {
    Chipmunk(Cli),
}

#[derive(clap::Args, Debug)]
#[command(author, version, about, long_about = None)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand, Debug, Clone)]
pub enum Command {
    /// Provides commands for the needed tools for the development
    #[clap(visible_alias = "env")]
    #[command(subcommand)]
    Environment(EnvironmentCommand),
    /// Prints an overview of targets dependencies in print-dot format for `Graphviz`
    #[clap(visible_alias = "dot")]
    PrintDot {
        /// Show all jobs and their relations
        #[arg(short, long, default_value_t = false)]
        all_jobs: bool,
    },
    /// Runs linting & clippy for all or the specified targets
    Lint {
        /// Target to lint, by default whole application will be linted
        #[arg(index = 1)]
        target: Option<Vec<Target>>,

        #[arg(short, long, help = FAIL_FAST_HELP_TEXT)]
        fail_fast: bool,

        #[arg(short, long, help = NO_UI_HELP_TEXT )]
        no_ui: bool,

        #[arg(short, long, value_name = REPORT_VALUE_NAME, help = REPORT_HELP_TEXT)]
        report: Option<Option<PathBuf>>,
    },
    /// Build all or the specified targets
    Build {
        /// Target to build, by default whole application will be built
        #[arg(index = 1)]
        target: Option<Vec<Target>>,

        /// Build release version
        #[arg(short, long, default_value_t = false)]
        production: bool,

        #[arg(short, long, help = FAIL_FAST_HELP_TEXT)]
        fail_fast: bool,

        #[arg(short, long, help = NO_UI_HELP_TEXT )]
        no_ui: bool,

        #[arg(short, long, value_name = REPORT_VALUE_NAME, help = REPORT_HELP_TEXT)]
        report: Option<Option<PathBuf>>,
    },
    /// Clean all or the specified targets
    Clean {
        /// Target to clean, by default whole application will be cleaned
        #[arg(index = 1)]
        target: Option<Vec<Target>>,

        #[arg(short, long, value_name = REPORT_VALUE_NAME, help = REPORT_HELP_TEXT)]
        report: Option<Option<PathBuf>>,
    },
    /// Run tests for all or the specified targets
    Test {
        /// Target to test, by default whole application will be tested
        #[arg(index = 1)]
        target: Option<Vec<Target>>,

        /// Test release version
        #[arg(short, long, default_value_t = false)]
        production: bool,

        #[arg(short, long, help = FAIL_FAST_HELP_TEXT)]
        fail_fast: bool,

        #[arg(short, long, help = NO_UI_HELP_TEXT )]
        no_ui: bool,

        #[arg(short, long, value_name = REPORT_VALUE_NAME, help = REPORT_HELP_TEXT)]
        report: Option<Option<PathBuf>>,
    },
    /// Build and Run the application
    Run {
        /// Run release version
        #[arg(short, long, default_value_t = false)]
        production: bool,

        #[arg(short, long, help = FAIL_FAST_HELP_TEXT)]
        fail_fast: bool,

        #[arg(short, long, help = NO_UI_HELP_TEXT )]
        no_ui: bool,
    },
    /// Resets the checksums records what is used to check if there were any code changes for
    /// each target.
    #[clap(visible_alias = "reset")]
    ResetChecksum {
        /// Reset release records
        #[arg(short, long, default_value_t = false)]
        production: bool,
    },
    /// Generate shell completion for the commands of this tool in the given shell,
    /// printing them to stdout.
    #[clap(visible_alias = "compl")]
    ShellCompletion {
        /// Shell to generate the completion for
        #[arg(value_enum)]
        shell: clap_complete::Shell,
    },
}

#[derive(Subcommand, Debug, Clone)]
pub enum EnvironmentCommand {
    /// Checks that all needed tools for the development are installed
    Check,
    /// Prints the information of the needed tools for the development
    #[clap(visible_alias = "list")]
    Print,
}
