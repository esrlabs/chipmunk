mod fstools;
mod location;
mod modules;
mod spawner;
mod target;
mod tracker;

use clap::{Parser, Subcommand};
use futures::future::join_all;
use location::Location;
use modules::Manager;
use std::{
    io::{Error, ErrorKind},
    path::PathBuf,
};
use target::Target;
use tracker::Tracker;

#[macro_use]
extern crate lazy_static;

lazy_static! {
    static ref LOCATION: Location =
        Location::new().expect("Fail to setup location of root of project");
    static ref TRACKER: Tracker = Tracker::new();
}

static REPORT_HELP_TEXT: &str =
    "Write report from command logs to the given file or to stdout if no file is defined";
static REPORT_VALUE_NAME: &str = "FILE-PATH";

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug, Clone)]
enum Command {
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

        #[arg(short, long, value_name = REPORT_VALUE_NAME, help = REPORT_HELP_TEXT)]
        report: Option<Option<PathBuf>>,
    },
    /// Run tests
    Test {
        /// Target to test, by default whole application will be tested
        #[arg(index = 1)]
        target: Option<Vec<Target>>,

        #[arg(short, long, value_name = REPORT_VALUE_NAME, help = REPORT_HELP_TEXT)]
        report: Option<Option<PathBuf>>,
    },
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let cli = Cli::parse();
    let command = cli.command;
    let results = match command {
        Command::Lint { target, report } => {
            dbg!(report);
            let targets = get_targets_or_default(target);
            join_all(
                targets
                    .iter()
                    .map(|module| module.check())
                    .collect::<Vec<_>>(),
            )
            .await
        }
        Command::Build {
            target,
            production,
            report,
        } => {
            dbg!(report);
            let targets = get_targets_or_default(target);
            join_all(
                targets
                    .iter()
                    .map(|module| module.build(production))
                    .collect::<Vec<_>>(),
            )
            .await
        }
        Command::Clean { target, report } => {
            dbg!(report);
            let targets = get_targets_or_default(target);
            join_all(
                targets
                    .iter()
                    .map(|module| module.reset())
                    .collect::<Vec<_>>(),
            )
            .await
        }
        Command::Test { target, report } => {
            dbg!(report);
            let targets = get_targets_or_default(target);
            join_all(
                targets
                    .iter()
                    .map(|module| module.test())
                    .collect::<Vec<_>>(),
            )
            .await
        }
    };
    TRACKER.shutdown().await?;
    let mut success: bool = true;
    results.iter().for_each(|res| match res {
        Ok(status) => {
            if !status.status.success() {
                eprintln!("Failed with errors");
                println!("{}:\n{}", status.job, status.stderr.join(""));
                success = false;
            }
        }
        Err(err) => {
            eprintln!("Builder error: {err}");
            success = false;
        }
    });
    if !success {
        return Err(Error::new(ErrorKind::Other, "Some task were failed"));
    }
    Ok(())
}

fn get_targets_or_default(targets: Option<Vec<Target>>) -> Vec<Box<dyn Manager + Sync + Send>> {
    if let Some(mut list) = targets {
        list.dedup();
        list.iter().map(|target| target.get()).collect()
    } else {
        Target::all()
    }
}
