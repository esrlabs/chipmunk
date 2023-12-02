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

pub async fn spawn(
    command: &str,
    cwd: Option<PathBuf>,
    caption: Option<&str>,
) -> Result<SpawnResult, io::Error> {
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
    let drain_stdout = {
        let storage = &mut stdout_lines;
        let stdout = child.stdout.take().unwrap();
        async move {
            let mut buf = BufReader::new(stdout);
            loop {
                let mut line = String::new();
                let read_lines = buf.read_line(&mut line).await?;
                if read_lines == 0 {
                    break;
                } else {
                    TRACKER.msg(sequence, &line).await;
                    TRACKER.progress(sequence, None).await;
                    storage.push(line);
                }
            }
            future::pending::<()>().await;
            Ok::<Option<ExitStatus>, io::Error>(None)
        }
    };

    let mut stderr_lines: Vec<String> = vec![];
    let drain_stderr = {
        let storage = &mut stderr_lines;
        let stderr = child.stderr.take().unwrap();
        async move {
            let mut buf = BufReader::new(stderr);
            loop {
                let mut line = String::new();
                let read_lines = buf.read_line(&mut line).await?;
                if read_lines == 0 {
                    break;
                } else {
                    TRACKER.progress(sequence, None).await;
                    if !line.trim().is_empty() {
                        storage.push(line);
                    }
                }
            }
            future::pending::<()>().await;
            Ok::<Option<ExitStatus>, io::Error>(None)
        }
    };
    let status = match drain_stdout
        .or(drain_stderr)
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
