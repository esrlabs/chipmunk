use crate::{
    jobs_runner::JobDefinition, location::get_root, target::ProcessCommand, tracker::get_tracker,
};
use anyhow::{bail, Context};
use core::panic;
use futures_lite::{future, FutureExt};
use std::{
    path::PathBuf,
    process::{ExitStatus, Stdio},
};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Command,
};

#[derive(Clone, Debug)]
pub struct SpawnResult {
    pub report: Vec<String>,
    pub status: ExitStatus,
    pub job: String,
    pub cmd: String,
    pub skipped: Option<bool>,
}

impl SpawnResult {
    /// Create spawn for multiple file system commands
    pub fn create_for_fs(job: String, report: Vec<String>) -> Self {
        SpawnResult {
            report,
            job,
            status: ExitStatus::default(),
            cmd: "Multiple file system commands".into(),
            skipped: None,
        }
    }

    /// Create spawn for jobs that has been skipped
    pub fn create_for_skipped(job: String, cmd: String) -> Self {
        SpawnResult {
            report: Vec::new(),
            job,
            status: ExitStatus::default(),
            cmd,
            skipped: Some(true),
        }
    }

    /// Append other result to the current one producing a combined results form them
    pub fn append(&mut self, other: SpawnResult) {
        if !other.report.is_empty() {
            self.report.extend(
                [
                    String::default(),
                    String::from("-------------------------------------------------------------------------------"), 
                    String::default()
                ]);
            self.report.extend(other.report);
        }

        self.job = format!("{} & {}", self.job, other.job);
        self.status = match (self.status.success(), other.status.success()) {
            (_, true) => self.status,
            (false, false) => self.status,
            (_, false) => other.status,
        };

        self.cmd = format!("{} \n {}", self.cmd, other.cmd);
        self.skipped = match (self.skipped, other.skipped) {
            (Some(false), _) | (_, Some(false)) => Some(false),
            (Some(true), _) | (_, Some(true)) => Some(true),
            _ => None,
        };
    }
}

#[derive(Debug, Clone, Default)]
pub(crate) struct SpawnOptions {
    /// Indicates that log messages should be not shown on UI.
    pub suppress_ui: bool,
    /// Indicates if the job is a part of build process and can be skipped.
    pub has_skip_info: bool,
}

/// Spawns and runs a job asynchronously, updating the bar when job infos are available
pub async fn spawn(
    job_def: JobDefinition,
    command: ProcessCommand,
    cwd: Option<PathBuf>,
    environment_vars: impl IntoIterator<Item = (String, String)>,
    opts: Option<SpawnOptions>,
) -> Result<SpawnResult, anyhow::Error> {
    let opts = opts.unwrap_or_default();
    let cwd = cwd.unwrap_or_else(|| get_root().clone());
    let mut combined_env_vars = vec![(String::from("TERM"), String::from("xterm-256color"))];
    combined_env_vars.extend(environment_vars);

    let tracker = get_tracker();

    let command_result = Command::new(&command.cmd)
        .current_dir(&cwd)
        .args(&command.args)
        .envs(combined_env_vars)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .with_context(|| {
            format!(
                "Error While running the command '{}'\nwith arguments: {:?}",
                command.cmd, command.args
            )
        });

    let mut child = command_result?;

    let drain_stdout_stderr = {
        let stdout = child.stdout.take().expect(
                "Developer Error: Stdout is implicity set in command definition from which the child is spawn",
            );
        let stderr = child.stderr.take().expect(
                "Developer Error: Stderr is implicity set in command definition from which the child is spawn",
            );
        async move {
            let mut stdout_buf = BufReader::new(stdout);
            let mut stderr_buf = BufReader::new(stderr);
            loop {
                let mut stdout_line = String::new();
                let mut stderr_line = String::new();
                tokio::select! {
                    stdout_read_result = stdout_buf.read_line(&mut stdout_line) => {
                        let stdout_read_bytes = stdout_read_result?;
                        if stdout_read_bytes == 0 {
                            break;
                        }

                        if opts.suppress_ui {
                            tracker.log(job_def, stdout_line);
                        } else{
                            tracker.msg(job_def, stdout_line);
                        }

                        tracker.progress(job_def, None);
                    }
                    stderr_read_result = stderr_buf.read_line(&mut stderr_line) => {
                        let stderr_read_bytes = stderr_read_result?;
                        if stderr_read_bytes == 0 {
                            break;
                        }

                        if !stderr_line.trim().is_empty() {
                            if opts.suppress_ui {
                                tracker.log(job_def, stderr_line);
                            } else {
                                tracker.msg(job_def, stderr_line);
                            }
                        }

                        tracker.progress(job_def, None);

                    }
                }
            }

            future::pending::<()>().await;
            Ok::<Option<ExitStatus>, anyhow::Error>(None)
        }
    };

    let status = drain_stdout_stderr
        .or(async move { Ok(Some(child.wait().await?)) })
        .await?;

    if let Some(status) = status {
        let skipped = if opts.has_skip_info {
            Some(false)
        } else {
            None
        };

        let report_lines = tracker.get_logs(job_def).await?.unwrap_or_default();

        Ok(SpawnResult {
            report: report_lines,
            status,
            job: job_def.job_title(),
            cmd: command.to_string(),
            skipped,
        })
    } else {
        bail!("Fail to get exist status of spawned command")
    }
}

/// Suspend the progress bars if enabled and run the giving blocking command using
/// `Stdio::inherit()` This is used with commands that doesn't work with `Stdio::piped()`
pub async fn spawn_blocking(
    job_def: JobDefinition,
    command: ProcessCommand,
    cwd: Option<PathBuf>,
    environment_vars: impl IntoIterator<Item = (String, String)>,
) -> Result<SpawnResult, anyhow::Error> {
    let cwd = cwd.unwrap_or_else(|| get_root().clone());

    let mut combined_env_vars = vec![(String::from("TERM"), String::from("xterm-256color"))];
    combined_env_vars.extend(environment_vars);

    let mut child = std::process::Command::new(&command.cmd);
    child.current_dir(&cwd);
    child.args(&command.args);
    child.envs(combined_env_vars);

    let tracker = get_tracker();

    let status = tracker.run_synchronously(job_def, child).await?;

    Ok(SpawnResult {
        report: Vec::new(),
        status,
        job: job_def.job_title(),
        cmd: command.to_string(),
        skipped: None,
    })
}

/// This spawns a new task and return immediately showing that the job has been skipped
pub async fn spawn_skip(job_def: JobDefinition, command: String) -> anyhow::Result<SpawnResult> {
    Ok(SpawnResult::create_for_skipped(
        job_def.job_title(),
        command,
    ))
}
