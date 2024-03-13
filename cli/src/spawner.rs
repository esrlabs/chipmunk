// cmd.envs(vec![("PATH", "/bin"), ("TERM", "xterm-256color")]);
use crate::{
    location::{get_root, to_relative_path},
    tracker::get_tracker,
};
use anyhow::bail;
use core::panic;
use futures_lite::{future, FutureExt};
use std::{
    env,
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
}

impl SpawnResult {
    pub fn empty() -> Self {
        SpawnResult {
            report: Vec::default(),
            status: ExitStatus::default(),
            job: String::new(),
            cmd: String::default(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.job.is_empty() && self.cmd.is_empty()
    }

    pub fn create_for_fs(job: String, report: Vec<String>) -> Self {
        SpawnResult {
            report,
            job,
            status: ExitStatus::default(),
            cmd: "Multiple file system commands".into(),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub(crate) struct SpawnOptions {
    pub suppress_msg: bool,
}

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
    let mut env_vars: Vec<_> = env::vars().chain(environment_vars).collect();
    env_vars.push((String::from("TERM"), String::from("xterm-256color")));

    let mut child = Command::new(cmd)
        .current_dir(&cwd)
        .args(parts)
        .envs(env_vars)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let job_title = caption;
    let tracker = get_tracker().await;
    let sequence = tracker
        .start(
            &format!("{}: {}", to_relative_path(&cwd).display(), job_title),
            None,
        )
        .await?;

    let mut report_lines: Vec<String> = vec![];
    let drain_stdout_stderr = {
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
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
        Ok(SpawnResult {
            report: report_lines,
            status,
            job: job_title,
            cmd: command,
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
    let mut env_vars: Vec<_> = env::vars().chain(environment_vars).collect();
    env_vars.push((String::from("TERM"), String::from("xterm-256color")));

    let mut child = std::process::Command::new(cmd);
    child.current_dir(&cwd);
    child.args(parts);
    child.envs(env_vars);

    let tracker = get_tracker().await;

    let sequence = tracker
        .start(
            &format!("{}: {}", to_relative_path(&cwd).display(), caption),
            None,
        )
        .await?;

    let status = match tracker.suspend_and_run(child).await {
        Ok(status) => status,
        Err(err) => {
            tracker.fail(sequence, &err.to_string()).await;
            return Err(err);
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
    })
}
