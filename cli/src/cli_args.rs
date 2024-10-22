//! Module for Command line commands and arguments and their descriptions.

use std::path::PathBuf;

use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};

use crate::{benchmark::BenchTarget, target::Target};

const FAIL_FAST_HELP_TEXT: &str = "Stops execution immediately if any job fails.";
const NO_FAIL_FAST_HELP_TEXT: &str = "Don't stops execution immediately if any job fails.";
const UI_LOG_OPTION_HELP_TEXT: &str =
    "Specifies the UI options for displaying command logs and progress in the terminal";
const HELP_TEMPLATE: &str = "\
{before-help}{about}
version: {version}

{usage-heading} {usage}

{all-args}{after-help}
";

// To enable calling the app as cargo subcommand the following changes were made:
// * Cli commands are nested are subcommand within Chipmunk command
// * Command name set to "cargo"
#[derive(Parser)]
#[command(name = "cargo", bin_name = "cargo")]
pub enum CargoCli {
    Chipmunk(Cli),
}

#[derive(clap::Args, Debug)]
#[command(author, version, about, help_template = HELP_TEMPLATE)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

// TODO: Keep tracking on GitHub issue Nr. 4416 on clap crate to remove the hard-coded
// alaises in options description.
// Link for the issue: https://github.com/clap-rs/clap/issues/4416.

#[derive(Debug, Clone, Copy, Default, clap::ValueEnum, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
/// Specifies the UI mode for displaying command logs and progress in the terminal.
pub enum UiMode {
    /// Displays progress bars, showing the current line of the output of each command. [aliases: 'b']
    #[default]
    #[value(name = "bars", alias("b"))]
    ProgressBars,
    /// Displays progress bars and prints a summary of all command logs to stdout after all jobs have finished. [aliases: 'r']
    #[value(name = "report", alias("r"))]
    BarsWithReport,
    /// Outputs each job's result to stdout once the job finishes. No progress bars are displayed. [aliases: 'p']
    #[value(name = "print", alias("p"))]
    PrintOnJobFinish,
    /// Outputs logs immediately as they are produced, which may cause overlapping logs for parallel jobs.
    /// No progress bars are displayed. [aliases: 'i']
    #[value(name = "immediate", alias("i"))]
    PrintImmediately,
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

        #[arg(short, long, default_value_t = UiMode::default(), help = UI_LOG_OPTION_HELP_TEXT, value_enum)]
        ui_mode: UiMode,
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

        #[arg(short, long, default_value_t = UiMode::default(), help = UI_LOG_OPTION_HELP_TEXT, value_enum)]
        ui_mode: UiMode,
    },
    /// Clean all or the specified targets
    Clean {
        /// Target to clean, by default whole application will be cleaned
        #[arg(index = 1)]
        target: Option<Vec<Target>>,

        #[arg(short, long, default_value_t = UiMode::default(), help = UI_LOG_OPTION_HELP_TEXT, value_enum)]
        ui_mode: UiMode,
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

        #[arg(short, long, default_value_t = UiMode::default(), help = UI_LOG_OPTION_HELP_TEXT, value_enum)]
        ui_mode: UiMode,

        /// Sets which test specifications should be run.
        /// Currently implemented for wrapper target (ts-bindings) only
        #[arg(short, long = "specs")]
        specifications: Vec<String>,
    },
    /// Build and Run the application
    Run {
        /// Run release version
        #[arg(short, long, default_value_t = false)]
        production: bool,

        #[arg(short, long, help = NO_FAIL_FAST_HELP_TEXT)]
        no_fail_fast: bool,
    },
    /// Builds Chipmunk and generates a release (defaults to Release mode).
    Release {
        /// Verbose logging
        #[arg(short, long, default_value_t = false)]
        verbose: bool,
        #[arg(short, long, help = FAIL_FAST_HELP_TEXT)]
        fail_fast: bool,
        /// Build chipmunk in development mode
        #[arg(short, long, default_value_t = false)]
        development: bool,
        /// Path to the configuration file for code signing
        #[arg(short, long)]
        code_sign: Option<PathBuf>,
    },
    /// Runs benchmarks for the given target, its input source and configuration.
    #[clap(visible_alias = "bench")]
    #[command(subcommand)]
    Benchmark(BenchTarget),
    /// Resets the checksums records what is used to check if there were any code changes for
    /// each target.
    #[clap(visible_alias = "reset")]
    ResetChecksum,
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
