//! Manages spawning the provided commands in both concurrent and sequential ways, while sending
//! their output and status to the `Tracker`.

use crate::{
    jobs_runner::JobDefinition,
    location::get_root,
    shell::{shell_std_command, shell_tokio_command},
    target::ProcessCommand,
    tracker::get_tracker,
    JobsState,
};
use anyhow::Context;
use core::panic;
use std::{
    path::PathBuf,
    process::{ExitStatus, Stdio},
};
use tokio::io::{AsyncBufReadExt, BufReader};

#[derive(Clone, Debug)]
pub struct SpawnResult {
    pub report: Vec<String>,
    pub status: ExitStatus,
    pub job: String,
    pub cmd: String,
    pub skipped: bool,
}

impl SpawnResult {
    /// Create spawn for multiple file system commands
    pub fn create_for_fs(job: String, report: Vec<String>) -> Self {
        SpawnResult {
            report,
            job,
            status: ExitStatus::default(),
            cmd: "Multiple file system commands".into(),
            skipped: false,
        }
    }

    /// Create spawn for jobs that has been skipped
    pub fn create_for_skipped(job: String, cmd: String) -> Self {
        SpawnResult {
            report: Vec::new(),
            job,
            status: ExitStatus::default(),
            cmd,
            skipped: true,
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
        self.skipped = self.skipped && other.skipped;
    }
}

#[derive(Debug, Clone, Default)]
pub(crate) struct SpawnOptions {
    /// Indicates that log messages should be not shown on UI.
    pub suppress_ui: bool,
}

/// Spawns and runs a job asynchronously, updating the bar when job infos are available
pub async fn spawn(
    job_def: JobDefinition,
    command: ProcessCommand,
    cwd: Option<PathBuf>,
    environment_vars: impl IntoIterator<Item = (String, String)>,
    opts: Option<SpawnOptions>,
) -> anyhow::Result<SpawnResult> {
    let opts = opts.unwrap_or_default();
    let cwd = cwd.unwrap_or_else(|| get_root().clone());
    let mut combined_env_vars = vec![(String::from("TERM"), String::from("xterm-256color"))];
    combined_env_vars.extend(environment_vars);

    let tracker = get_tracker();
    let cmd_combined = command.combine();
    let cmd_msg = format!("Running command: {cmd_combined}");
    tracker.msg(job_def, cmd_msg);
    let cwd_msg = format!("Running in directory: {}", cwd.display());
    tracker.msg(job_def, cwd_msg);

    let command_result = shell_tokio_command()
        .arg(cmd_combined)
        .current_dir(&cwd)
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

    let stdout = child.stdout.take()
        .expect("Developer Error: Stdout is implicitly set in command definition from which the child is spawn");
    let stderr = child.stderr.take()
        .expect("Developer Error: Stderr is implicitly set in command definition from which the child is spawn");
    let mut stdout_buf = BufReader::new(stdout);
    let mut stderr_buf = BufReader::new(stderr);

    let cancel = JobsState::get().cancellation_token();
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
                        tracker.log_err(job_def, stderr_line);
                    } else {
                        tracker.msg_err(job_def, stderr_line);
                    }
                }

                tracker.progress(job_def, None);

            }
            _ = cancel.cancelled() => {
                child.start_kill().context("Error while trying to kill the process as cancellation token has been invoked")?;
            },
        }
    }

    let status = child.wait().await?;

    let report_lines = tracker.get_logs(job_def).await?.unwrap_or_default();

    Ok(SpawnResult {
        report: report_lines,
        status,
        job: job_def.job_title(),
        cmd: command.to_string(),
        skipped: false,
    })
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

    let tracker = get_tracker();

    let cmd_combined = command.combine();
    let cmd_msg = format!("Running command: {cmd_combined}");
    tracker.msg(job_def, cmd_msg);
    let cwd_msg = format!("Running in directory: {}", cwd.display());
    tracker.msg(job_def, cwd_msg);

    let mut cmd = shell_std_command();
    cmd.arg(cmd_combined);
    cmd.current_dir(&cwd);
    cmd.envs(combined_env_vars);

    let status = tracker.run_synchronously(job_def, cmd).await?;

    Ok(SpawnResult {
        report: Vec::new(),
        status,
        job: job_def.job_title(),
        cmd: command.to_string(),
        skipped: false,
    })
}

/// This spawns a new task and return immediately showing that the job has been skipped
pub async fn spawn_skip(job_def: JobDefinition, command: String) -> anyhow::Result<SpawnResult> {
    let skip_result = SpawnResult::create_for_skipped(job_def.job_title(), command);

    Ok(skip_result)
}
