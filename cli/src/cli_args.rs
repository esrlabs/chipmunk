use std::path::PathBuf;

use clap::{Parser, Subcommand};

use crate::target::Target;

static REPORT_HELP_TEXT: &str =
    "Write report from command logs to the given file or to stdout if no file is defined";
static REPORT_VALUE_NAME: &str = "FILE-PATH";

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
    /// Checks that all needed tools for the development are installed
    #[clap(visible_alias = "env")]
    Environment,
    /// Runs linting & clippy
    Lint {
        /// Target to lint, by default whole application will be linted
        #[arg(index = 1)]
        target: Option<Vec<Target>>,

        #[arg(short, long, value_name = REPORT_VALUE_NAME, help = REPORT_HELP_TEXT)]
        report: Option<Option<PathBuf>>,
    },
    /// Build
    Build {
        /// Target to build, by default whole application will be built
        #[arg(index = 1)]
        target: Option<Vec<Target>>,

        /// Build release version
        #[arg(short, long, default_value_t = false)]
        production: bool,

        #[arg(short, long, value_name = REPORT_VALUE_NAME, help = REPORT_HELP_TEXT)]
        report: Option<Option<PathBuf>>,
    },
    /// Clean
    Clean {
        /// Target to clean, by default whole application will be cleaned
        #[arg(index = 1)]
        target: Option<Vec<Target>>,

        /// Clean release version
        #[arg(short, long, default_value_t = false)]
        production: bool,

        #[arg(short, long, value_name = REPORT_VALUE_NAME, help = REPORT_HELP_TEXT)]
        report: Option<Option<PathBuf>>,
    },
    /// Run tests
    Test {
        /// Target to test, by default whole application will be tested
        #[arg(index = 1)]
        target: Option<Vec<Target>>,

        /// Test release version
        #[arg(short, long, default_value_t = false)]
        production: bool,

        #[arg(short, long, value_name = REPORT_VALUE_NAME, help = REPORT_HELP_TEXT)]
        report: Option<Option<PathBuf>>,
    },
    /// Build and Run the application
    Run {
        /// Run release version
        #[arg(short, long, default_value_t = false)]
        production: bool,
    },
}
