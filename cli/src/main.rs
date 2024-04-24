mod app_runner;
mod build_state;
mod check_env;
mod cli_args;
mod fstools;
mod location;
mod modules;
mod spawner;
mod target;
mod tracker;

use anyhow::{bail, Error};
use check_env::check_env;
use clap::Parser;
use cli_args::{CargoCli, Command};
use futures::future::join_all;
use location::init_location;
use modules::Manager;
use spawner::SpawnResult;
use std::{
    fs::File,
    io::{self, stdout, Stdout},
    path::PathBuf,
};
use target::Target;
use tracker::get_tracker;

#[derive(Debug)]
pub enum ReportOptions {
    None,
    Stdout(Stdout),
    File(PathBuf, File),
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let CargoCli::Chipmunk(cli) = CargoCli::parse();

    check_env()?;

    init_location()?;

    // Run the given command
    let command = cli.command;
    let report_opt: ReportOptions;
    let mut run_app = false;
    let results = match command {
        Command::Environment => {
            // Check for dependencies is already called before calling any command
            println!("All needed tools for development are installed");
            return Ok(());
        }
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
        Command::Run { production } => {
            report_opt = ReportOptions::None;
            run_app = true;
            join_all(
                Target::all()
                    .iter()
                    .map(|module| module.build(production))
                    .collect::<Vec<_>>(),
            )
            .await
        }
    };

    // Shutdown and show results & report
    let tracker = get_tracker().await;
    tracker.shutdown().await?;
    let mut success: bool = true;
    for (idx, res) in results.iter().enumerate() {
        match res {
            Ok(statuses) => {
                for status in statuses {
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
                                let full_path =
                                    path.canonicalize().unwrap_or_else(|_| path.to_owned());
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
            }
            Err(err) => {
                eprintln!("Builder error: {err}");
                success = false;
            }
        }
    }
    if !success {
        bail!("Some task were failed")
    } else if run_app {
        println!("Starting chipmunk...");
        let status = app_runner::run_app().await?;
        if !status.success() {
            bail!("Error: Chipmunk Exited with the Code {status}");
        }
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

        if !line.ends_with('\n') {
            writeln!(writer)?;
        }
    }

    Ok(())
}