mod app_runner;
mod checksum_records;
mod cli_args;
mod dev_environment;
mod dev_tools;
mod fail_fast;
mod fstools;
mod job_type;
mod jobs_runner;
mod location;
mod print_dot;
mod shell_completion;
mod spawner;
mod target;
mod tracker;

use anyhow::{bail, Error};
use checksum_records::ChecksumRecords;
use clap::Parser;
use cli_args::{CargoCli, Command};
use dev_environment::{print_env_info, resolve_dev_tools};
use fail_fast::set_fail_fast;
use job_type::JobType;
use location::init_location;
use spawner::SpawnResult;
use std::{
    fs::File,
    io::{self, stdout, Stdout},
    path::PathBuf,
};
use target::Target;
use tracker::{get_tracker, init_tracker};

use crate::cli_args::EnvironmentCommand;

#[derive(Debug)]
pub enum ReportOptions {
    None,
    Stdout(Stdout),
    File(PathBuf, File),
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let CargoCli::Chipmunk(cli) = CargoCli::parse();

    init_location()?;

    // Run the given command
    let command = cli.command;
    let report_opt: ReportOptions;
    let (job_type, results) = match command {
        Command::Environment(sub_command) => match sub_command {
            EnvironmentCommand::Check => {
                resolve_dev_tools()?;
                println!("All needed tools for development are installed");
                return Ok(());
            }
            EnvironmentCommand::Print => {
                print_env_info();
                return Ok(());
            }
        },
        Command::PrintDot { all_jobs } => {
            if all_jobs {
                print_dot::print_dependencies_jobs();
            } else {
                print_dot::print_dependencies_targets();
            }
            return Ok(());
        }
        Command::Lint {
            target,
            report,
            fail_fast,
            no_ui,
        } => {
            set_fail_fast(fail_fast);
            init_tracker(no_ui);
            resolve_dev_tools()?;
            report_opt = get_report_option(report)?;
            let targets = get_targets_or_default(target);
            let results = jobs_runner::run(&targets, JobType::Lint).await?;
            (JobType::Lint, results)
        }
        Command::Build {
            target,
            production,
            fail_fast,
            no_ui,
            report,
        } => {
            set_fail_fast(fail_fast);
            init_tracker(no_ui);
            resolve_dev_tools()?;
            report_opt = get_report_option(report)?;
            let targets = get_targets_or_default(target);
            let results = jobs_runner::run(&targets, JobType::Build { production }).await?;
            (JobType::Build { production }, results)
        }
        Command::Clean { target, report } => {
            resolve_dev_tools()?;
            report_opt = get_report_option(report)?;
            let targets = get_targets_or_default(target);
            let results = jobs_runner::run(&targets, JobType::Clean).await?;
            (JobType::Clean, results)
        }
        Command::Test {
            target,
            production,
            fail_fast,
            no_ui,
            report,
        } => {
            set_fail_fast(fail_fast);
            init_tracker(no_ui);
            resolve_dev_tools()?;
            report_opt = get_report_option(report)?;
            let targets = get_targets_or_default(target);
            let results = jobs_runner::run(&targets, JobType::Test { production }).await?;
            (JobType::Test { production }, results)
        }
        Command::Run {
            production,
            fail_fast,
            no_ui,
        } => {
            set_fail_fast(fail_fast);
            init_tracker(no_ui);
            resolve_dev_tools()?;
            report_opt = ReportOptions::None;
            let results = jobs_runner::run(&[Target::App], JobType::Build { production }).await?;
            (JobType::Run { production }, results)
        }
        Command::ResetChecksum { production } => {
            ChecksumRecords::remove_records_file(production)?;
            println!(
                "Checksum-Records for {} has been reset",
                if production {
                    "production"
                } else {
                    "development"
                }
            );

            return Ok(());
        }
        Command::ShellCompletion { shell } => {
            shell_completion::generate_completion(shell)?;

            return Ok(());
        }
    };

    // Shutdown and show results & report
    let tracker = get_tracker();
    tracker.shutdown().await?;
    let mut success: bool = true;
    for (idx, res) in results.iter().enumerate() {
        match res {
            Ok(status) => {
                let print_err = match &report_opt {
                    ReportOptions::None => true,
                    ReportOptions::Stdout(stdout) => {
                        write_report(status, stdout)?;
                        false
                    }
                    ReportOptions::File(path, file) => {
                        write_report(status, file)?;
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
                        eprintln!(
                            "---------------------------------------------------------------------"
                        );
                    }
                    success = false;
                }
            }
            Err(err) => {
                eprintln!("Builder error: {:?}", err);
                eprintln!("---------------------------------------------------------------------");
                success = false;
            }
        }
    }
    if !success {
        bail!("Some task were failed")
    };

    ChecksumRecords::update_and_save(job_type)?;

    if matches!(job_type, JobType::Run { .. }) {
        println!("Starting chipmunk...");
        let status = app_runner::run_app().await?;
        if !status.success() {
            bail!("Error: Chipmunk Exited with the Code {status}");
        }
    }
    Ok(())
}

fn get_targets_or_default(targets: Option<Vec<Target>>) -> Vec<Target> {
    if let Some(mut list) = targets {
        list.dedup();
        list
    } else {
        Target::all().to_vec()
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
    writeln!(writer)?;
    writeln!(
        writer,
        "===================================================="
    )?;
    writeln!(writer)?;

    let status = match (spawn_result.skipped, spawn_result.status.success()) {
        (Some(true), _) => "been skipped",
        (_, true) => "succeeded",
        (_, false) => "failed",
    };

    writeln!(writer, "Job '{}' has {status}", spawn_result.job)?;
    writeln!(writer, "Command: {}", spawn_result.cmd)?;
    if spawn_result.skipped.is_some_and(|skipped| skipped) {
        return Ok(());
    }

    writeln!(writer, "Logs:")?;
    for line in spawn_result.report.iter() {
        writer.write_all(line.as_bytes())?;

        if !line.ends_with('\n') {
            writeln!(writer)?;
        }
    }

    Ok(())
}
