// cmd.envs(vec![("PATH", "/bin"), ("TERM", "xterm-256color")]);
use crate::{
    location::to_relative_path,
    {LOCATION, TRACKER},
};
use async_process::{Command, ExitStatus, Stdio};
use async_std::{io::BufReader, prelude::*};
use futures_lite::{future, FutureExt};
use std::{env::vars, io, path::PathBuf};

#[derive(Clone, Debug)]
pub struct SpawnResult {
    pub stdout: Vec<String>,
    pub stderr: Vec<String>,
    pub status: ExitStatus,
    pub job: String,
}

impl SpawnResult {
    pub fn empty() -> Self {
        SpawnResult {
            stdout: vec![],
            stderr: vec![],
            status: ExitStatus::default(),
            job: String::new(),
        }
    }
}

#[derive(Debug, Clone, Default)]
pub(crate) struct SpawnOptions {
    pub suppress_msg: bool,
}

pub async fn spawn(
    command: &str,
    cwd: Option<PathBuf>,
    caption: Option<&str>,
    opts: Option<SpawnOptions>,
) -> Result<SpawnResult, io::Error> {
    let opts = opts.unwrap_or_default();
    let cwd = if let Some(cwd) = cwd {
        cwd
    } else {
        LOCATION.root.clone()
    };
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
    let job_title = if let Some(caption) = caption {
        caption
    } else {
        cmd
    };
    let sequence = TRACKER
        .start(
            &format!("{}: {}", to_relative_path(&cwd).display(), job_title),
            None,
        )
        .await?;

    let mut stdout_lines: Vec<String> = vec![];
    let mut stderr_lines: Vec<String> = vec![];
    let drain_stdout_stderr = {
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        let storage_out = &mut stdout_lines;
        let storage_err = &mut stderr_lines;
        async move {
            use futures::{select, FutureExt};

            let mut stdout_buf = BufReader::new(stdout);
            let mut stderr_buf = BufReader::new(stderr);
            loop {
                let mut stdout_line = String::new();
                let mut stderr_line = String::new();
                select! {
                    out_lines = stdout_buf.read_line(&mut stdout_line).fuse() => {
                        let out_lines = out_lines?;
                        if out_lines == 0 {
                            break;
                        } else {
                            if !opts.suppress_msg {
                                TRACKER.msg(sequence, &stdout_line).await;
                            }
                            TRACKER.progress(sequence, None).await;
                            storage_out.push(stdout_line);
                        }
                    }
                    err_lines = stderr_buf.read_line(&mut stderr_line).fuse() => {
                        let err_lines = err_lines?;
                        if err_lines == 0 {
                            break;
                        } else {
                            TRACKER.progress(sequence, None).await;
                            if !stderr_line.trim().is_empty() {
                                storage_err.push(stderr_line);
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
        .or(async move { Ok(Some(child.status().await?)) })
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
            stdout: stdout_lines,
            stderr: stderr_lines,
            status,
            job: job_title.to_string(),
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
