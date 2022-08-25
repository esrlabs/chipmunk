use crate::{ByteSource, Error as SourceError, ReloadInfo, SourceFilter};
use async_trait::async_trait;
use buf_redux::Buffer;
use futures;
use std::{collections::HashMap, process::Stdio};
use thiserror::Error;
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::{Child, ChildStderr, ChildStdout, Command},
    select,
};

#[derive(Error, Debug)]
pub enum ProcessError {
    #[error("Process setup problem: {0}")]
    Setup(String),
    #[error("Unrecoverable process error: {0}")]
    Unrecoverable(String),
}

pub struct ProcessSource {
    process: Child,
    buffer: Buffer,
    amount: usize,
    stdout: BufReader<ChildStdout>,
    stderr: BufReader<ChildStderr>,
}

impl Drop for ProcessSource {
    fn drop(&mut self) {
        if let Err(err) = futures::executor::block_on(self.process.kill()) {
            error!("Fail to kill child process: {}", err);
        }
    }
}

impl ProcessSource {
    pub async fn new(
        command: String,
        args: Vec<String>,
        envs: HashMap<String, String>,
    ) -> Result<Self, ProcessError> {
        let mut process = Command::new(command)
            .args(args)
            .envs(envs)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| ProcessError::Setup(format!("{}", e)))?;
        let stdout = process
            .stdout
            .take()
            .map(BufReader::new)
            .ok_or_else(|| ProcessError::Setup(String::from("Fail to get stdout handle")))?;
        let stderr = process
            .stderr
            .take()
            .map(BufReader::new)
            .ok_or_else(|| ProcessError::Setup(String::from("Fail to get stderr handle")))?;
        Ok(Self {
            process,
            buffer: Buffer::new(),
            amount: 0,
            stdout,
            stderr,
        })
    }
}

#[async_trait]
impl ByteSource for ProcessSource {
    async fn reload(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        let output = select! {
            buffer = async {
                let mut out = String::new();
                self.stdout.read_line(&mut out).await.map_err(|e| SourceError::Unrecoverable(format!(
                    "Reading line from stdout failed: {}",
                    e
                ))).map(|_| out)
            } => buffer,
            buffer = async {
                let mut out = String::new();
                self.stderr.read_line(&mut out).await.map_err(|e| SourceError::Unrecoverable(format!(
                    "Reading line from stdout failed: {}",
                    e
                ))).map(|_| out)
            } => buffer,
        }?;
        self.amount = output.len();
        if self.amount == 0 {
            return Ok(None);
        }
        self.buffer.copy_from_slice(output.as_bytes());
        Ok(Some(ReloadInfo::new(self.amount, self.amount, 0, None)))
    }

    fn current_slice(&self) -> &[u8] {
        self.buffer.buf()
    }

    fn consume(&mut self, offset: usize) {
        self.buffer.consume(offset);
    }

    fn len(&self) -> usize {
        self.buffer.len()
    }

    fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[tokio::test]
async fn test_process() -> Result<(), ProcessError> {
    let mut command = "";
    if cfg!(windows) {
        command = "help";
    } else if cfg!(unix) {
        command = "ls";
    }
    let envs = HashMap::new();
    let args = Vec::new();
    match ProcessSource::new(command.to_string(), args, envs).await {
        Ok(mut process_source) => {
            while process_source
                .reload(None)
                .await
                .expect("Reload data from process source failed")
                .is_some()
            {
                assert!(!process_source.current_slice().is_empty());
                process_source.consume(process_source.current_slice().len());
            }
            Ok(())
        }
        Err(err) => Err(err),
    }
}
