mod fstools;
mod location;
mod modules;
mod spawner;
mod target;
mod tracker;

use clap::{Parser, Subcommand};
use futures::future::join_all;
use location::init_location;
use modules::Manager;
use spawner::SpawnResult;
use std::{
    fs::File,
    io::{self, stdout, Error, ErrorKind, Stdout},
    path::PathBuf,
};
use target::Target;
use tracker::Tracker;

#[macro_use]
extern crate lazy_static;

lazy_static! {
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

#[derive(Debug)]
enum ReportOptions {
    None,
    Stdout(Stdout),
    File(PathBuf, File),
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

    init_location()?;

    let command = cli.command;
    let report_opt: ReportOptions;
    let results = match command {
        Command::Lint { target, report } => {
            report_opt = get_report_option(report)?;
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
            report_opt = get_report_option(report)?;
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
            report_opt = get_report_option(report)?;
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
            report_opt = get_report_option(report)?;
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
    for (idx, res) in results.iter().enumerate() {
        match res {
            Ok(status) => {
                let print_err = match &report_opt {
                    ReportOptions::None => true,
                    ReportOptions::Stdout(stdout) => {
                        if !status.is_empty() {
                            write_report(status, stdout)?;
                        }
                        false
                    }
                    ReportOptions::File(path, file) => {
                        if !status.is_empty() {
                            write_report(status, file)?;
                        }
                        if idx == results.len() - 1 {
                            let full_path = path.canonicalize().unwrap_or_else(|_| path.to_owned());
                            println!("Report is written to '{}'", full_path.display());
                        }
                        false
                    }
                };

                if !status.status.success() {
                    if print_err {
                        eprintln!("Failed with errors");
                        eprintln!("{}:\n{}", status.job, status.report.join(""));
                    }
                    success = false;
                }
            }
            Err(err) => {
                eprintln!("Builder error: {err}");
                success = false;
            }
        }
    }
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

fn get_report_option(report_argument: Option<Option<PathBuf>>) -> Result<ReportOptions, Error> {
    match report_argument {
        None => Ok(ReportOptions::None),
        Some(None) => Ok(ReportOptions::Stdout(stdout())),
        Some(Some(path)) => {
            let file = File::create(&path)?;
            Ok(ReportOptions::File(path, file))
        }
    }
}

fn write_report(spawn_result: &SpawnResult, mut writer: impl io::Write) -> Result<(), io::Error> {
    assert!(!spawn_result.is_empty());

    writeln!(writer)?;
    writeln!(
        writer,
        "===================================================="
    )?;
    writeln!(writer)?;

    let status = if spawn_result.status.success() {
        "succeeded"
    } else {
        "failed"
    };

    writeln!(writer, "Job '{}' has {status}", spawn_result.job)?;
    writeln!(writer, "Command: {}", spawn_result.cmd)?;
    writeln!(writer, "Logs:")?;

    for line in spawn_result.report.iter() {
        writer.write_all(line.as_bytes())?;
    }

    Ok(())
}
