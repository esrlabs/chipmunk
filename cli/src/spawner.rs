// cmd.envs(vec![("PATH", "/bin"), ("TERM", "xterm-256color")]);
use crate::{
    location::to_relative_path,
    {LOCATION, TRACKER},
};
use futures_lite::{future, FutureExt};
use std::{
    env::vars,
    io,
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
        self.report.is_empty() && 
        self.job.is_empty() && 
        self.cmd.is_empty() &&
        // Default status indicates successful completion
        self.status.success() 
    }
}

#[derive(Debug, Clone, Default)]
pub(crate) struct SpawnOptions {
    pub suppress_msg: bool,
}

pub async fn spawn(
    command: &str,
    cwd: Option<PathBuf>,
    caption: String,
    opts: Option<SpawnOptions>,
) -> Result<SpawnResult, io::Error> {
    let opts = opts.unwrap_or_default();
    let cwd = cwd.unwrap_or_else(|| LOCATION.root.clone());
    let mut parts = command.split(' ').collect::<Vec<&str>>();
    let cmd = parts.remove(0);
    #[allow(clippy::useless_vec)]
    let mut child = Command::new(cmd)
        .current_dir(&cwd)
        .args(parts)
        .envs(
            vec![
                vars().collect::<Vec<(String, String)>>(),
                vec![(String::from("TERM"), String::from("xterm-256color"))],
            ]
            .concat(),
        )
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let job_title = caption;
    let sequence = TRACKER
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
                                TRACKER.msg(sequence, &stdout_line).await;
                            }
                            TRACKER.progress(sequence, None).await;
                            storage_report.push(stdout_line);
                        }
                    }
                    stderr_read_result = stderr_buf.read_line(&mut stderr_line) => {
                        let stderr_read_bytes = stderr_read_result?;
                        if stderr_read_bytes == 0 {
                            break;
                        } else {
                            TRACKER.progress(sequence, None).await;
                            if !stderr_line.trim().is_empty() {
                                storage_report.push(stderr_line);
                            }
                        }

                    }
                }
            }

            future::pending::<()>().await;
            Ok::<Option<ExitStatus>, io::Error>(None)
        }
    };

    let status = match drain_stdout_stderr
        .or(async move { Ok(Some(child.wait().await?)) })
        .await
    {
        Ok(status) => status,
        Err(err) => {
            TRACKER.fail(sequence, &err.to_string()).await;
            return Err(err);
        }
    };
    if let Some(status) = status {
        if status.success() {
            TRACKER.success(sequence, "").await;
        } else {
            TRACKER.fail(sequence, "finished with errors").await;
        }
        Ok(SpawnResult {
            report: report_lines,
            status,
            job: job_title,
            cmd: command.to_owned(),
        })
    } else {
        TRACKER
            .fail(sequence, "Fail to get exist status of spawned command")
            .await;
        Err(io::Error::new(
            io::ErrorKind::Other,
            "Fail to get exist status of spawned command",
        ))
    }
}
