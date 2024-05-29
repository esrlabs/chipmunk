// cmd.envs(vec![("PATH", "/bin"), ("TERM", "xterm-256color")]);
use crate::{
    location::{get_root, to_relative_path},
    tracker::get_tracker,
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
}

#[derive(Debug, Clone, Default)]
pub(crate) struct SpawnOptions {
    pub suppress_msg: bool,
    pub has_skip_info: bool,
}

/// Spawns and runs a job asynchronously, updating the bar when job infos are available
pub async fn spawn(
    command: String,
    cwd: Option<PathBuf>,
    caption: String,
    environment_vars: impl IntoIterator<Item = (String, String)>,
    opts: Option<SpawnOptions>,
) -> Result<SpawnResult, anyhow::Error> {
    let opts = opts.unwrap_or_default();
    let cwd = cwd.unwrap_or_else(|| get_root().clone());
    let mut parts = command.split(' ').collect::<Vec<&str>>();
    let cmd = parts.remove(0);
    let mut combined_env_vars = vec![(String::from("TERM"), String::from("xterm-256color"))];
    combined_env_vars.extend(environment_vars);

    let tracker = get_tracker().await;
    let sequence = tracker
        .start(&format!(
            "{}: {}",
            to_relative_path(&cwd).display(),
            caption
        ))
        .await?;

    let command_result = Command::new(cmd)
        .current_dir(&cwd)
        .args(&parts)
        .envs(combined_env_vars)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| {
            format!("Error While running the command '{cmd}'\nwith arguments: {parts:?}")
        });

    let mut child = match command_result {
        Ok(child) => child,
        Err(err) => {
            tracker.fail(sequence, format!("{err:#}").as_str()).await;
            return Err(err);
        }
    };

    let mut report_lines: Vec<String> = vec![];
    let drain_stdout_stderr = {
        let stdout = child.stdout.take().expect(
                "Developer Error: Stdout is implicity set in command definition from which the child is spawn",
            );
        let stderr = child.stderr.take().expect(
                "Developer Error: Stderr is implicity set in command definition from which the child is spawn",
            );
        let storage_report = &mut report_lines;
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
                        } else {
                            if !opts.suppress_msg {
                                tracker.msg(sequence, &stdout_line).await;
                            }
                            tracker.progress(sequence, None).await;
                            storage_report.push(stdout_line);
                        }
                    }
                    stderr_read_result = stderr_buf.read_line(&mut stderr_line) => {
                        let stderr_read_bytes = stderr_read_result?;
                        if stderr_read_bytes == 0 {
                            break;
                        } else {
                            tracker.progress(sequence, None).await;
                            if !stderr_line.trim().is_empty() {
                                storage_report.push(stderr_line);
                            }
                        }

                    }
                }
            }

            future::pending::<()>().await;
            Ok::<Option<ExitStatus>, anyhow::Error>(None)
        }
    };

    let status = match drain_stdout_stderr
        .or(async move { Ok(Some(child.wait().await?)) })
        .await
    {
        Ok(status) => status,
        Err(err) => {
            tracker.fail(sequence, &err.to_string()).await;
            return Err(err);
        }
    };
    if let Some(status) = status {
        if status.success() {
            tracker.success(sequence, "").await;
        } else {
            tracker.fail(sequence, "finished with errors").await;
        }

        let skipped = if opts.has_skip_info {
            Some(false)
        } else {
            None
        };

        Ok(SpawnResult {
            report: report_lines,
            status,
            job: caption,
            cmd: command,
            skipped,
        })
    } else {
        tracker
            .fail(sequence, "Fail to get exist status of spawned command")
            .await;
        bail!("Fail to get exist status of spawned command")
    }
}

/// Suspend the progress bars and run the giving blocking command using `Stdio::inherit()`
/// This is used with commands that doesn't work with `Stdio::piped()`
pub async fn spawn_blocking(
    command: String,
    cwd: Option<PathBuf>,
    caption: String,
    environment_vars: impl IntoIterator<Item = (String, String)>,
) -> Result<SpawnResult, anyhow::Error> {
    let cwd = cwd.unwrap_or_else(|| get_root().clone());
    let mut parts = command.split(' ').collect::<Vec<&str>>();
    let cmd = parts.remove(0);

    let mut combined_env_vars = vec![(String::from("TERM"), String::from("xterm-256color"))];
    combined_env_vars.extend(environment_vars);

    let mut child = std::process::Command::new(cmd);
    child.current_dir(&cwd);
    child.args(&parts);
    child.envs(combined_env_vars);

    let tracker = get_tracker().await;

    let sequence = tracker
        .start(&format!(
            "{}: {}",
            to_relative_path(&cwd).display(),
            caption
        ))
        .await?;

    let status = match tracker.suspend_and_run(child).await {
        Ok(status) => status,
        Err(err) => {
            tracker.fail(sequence, &err.to_string()).await;
            bail!("Error While running the command '{cmd}'\nwith arguments: {parts:?}\ncwd: {}\n Error Info: {err}", cwd.display());
        }
    };

    if status.success() {
        tracker.success(sequence, "").await;
    } else {
        tracker.fail(sequence, "finished with errors").await;
    }

    Ok(SpawnResult {
        report: Vec::new(),
        status,
        job: caption,
        cmd: command,
        skipped: None,
    })
}

/// This spawns a new task and return immediately showing that the job has been skipped
pub async fn spawn_skip(
    command: String,
    cwd: Option<PathBuf>,
    caption: String,
) -> anyhow::Result<SpawnResult> {
    let cwd = cwd.unwrap_or_else(|| get_root().clone());

    let tracker = get_tracker().await;
    let sequence = tracker
        .start(&format!(
            "{}: {}",
            to_relative_path(&cwd).display(),
            caption
        ))
        .await?;

    tracker.success(sequence, "skipped").await;

    Ok(SpawnResult::create_for_skipped(caption, command))
}
