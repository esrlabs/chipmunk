use crate::{ByteSource, Error as SourceError, ReloadInfo, SourceFilter};
use async_trait::async_trait;
use buf_redux::Buffer;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, process::Stdio};
use thiserror::Error;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
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
    stdout_reader: Option<BufReader<ChildStdout>>,
    stderr_reader: Option<BufReader<ChildStderr>>,
}

impl ProcessSource {
    pub async fn new(
        command: String,
        args: Vec<String>,
        envs: HashMap<String, String>,
    ) -> Result<Self, ProcessError> {
        Ok(Self {
            process: Command::new(command)
                .args(args)
                .envs(envs)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| ProcessError::Setup(format!("{}", e)))?,
            buffer: Buffer::new(),
            amount: 0,
            stdout_reader: None,
            stderr_reader: None,
        })
    }
}

#[derive(Serialize)]
pub struct StdinWriteReport {
    bytes: usize,
}

#[derive(Deserialize, Serialize)]
pub struct StdinRequestReport {
    data: String,
}

#[async_trait]
impl ByteSource for ProcessSource {
    async fn reload(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        if self.stdout_reader.is_none() {
            match self.process.stdout.take() {
                Some(stdout) => self.stdout_reader = Some(BufReader::new(stdout)),
                None => {
                    return Err(SourceError::Unrecoverable(
                        "Detecting stdout failed".to_string(),
                    ))
                }
            }
        }
        if self.stderr_reader.is_none() {
            match self.process.stderr.take() {
                Some(stderr) => self.stderr_reader = Some(BufReader::new(stderr)),
                None => {
                    return Err(SourceError::Unrecoverable(
                        "Detecting stderr failed".to_string(),
                    ))
                }
            }
        }
        match select! {
            stdout_buffer = async {
                let mut stdout_buffer = String::new();
                match &mut self.stdout_reader {
                    Some(reader) => {
                        match reader.read_line(&mut stdout_buffer).await {
                            Ok(_) => Ok(stdout_buffer),
                            Err(err) => {
                                Err(SourceError::Unrecoverable(format!(
                                    "Reading line from stdout failed: {}",
                                    err
                                )))
                            }
                        }
                    },
                    None => Err(SourceError::Unrecoverable(
                            "Stdout reader not found".to_string(),
                        ))
                }
            } => stdout_buffer,
            stderr_buffer = async {
                let mut stderr_buffer = String::new();
                match &mut self.stderr_reader {
                    Some(reader) => {
                        match reader.read_line(&mut stderr_buffer).await {
                            Ok(_) => Ok(stderr_buffer),
                            Err(err) => {
                                Err(SourceError::Unrecoverable(format!(
                                    "Reading line from stderr failed: {}",
                                    err
                                )))
                            },
                        }
                    },
                    None => Err(SourceError::Unrecoverable(
                            "Stderr reader not found".to_string(),
                        ))
                }
            } => stderr_buffer,
        } {
            Ok(read) => {
                self.amount = read.len();
                if self.amount == 0 {
                    return Ok(None);
                }
                self.buffer.copy_from_slice(read.as_bytes());
                Ok(Some(ReloadInfo::new(self.amount, self.amount, 0, None)))
            }
            Err(err) => Err(err),
        }
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

    async fn income(&mut self, msg: String) -> Result<String, String> {
        let message = serde_json::from_str::<StdinRequestReport>(&msg)
            .map_err(|e| format!("Fail to deserialize message: {}", e))?;
        if let Some(stdin) = self.process.stdin.as_mut() {
            stdin
                .write(message.data.as_bytes())
                .await
                .map_err(|e| format!("Fail to write into stdin: {}", e))?;
        }
        serde_json::to_string(&StdinWriteReport {
            bytes: msg.as_bytes().len(),
        })
        .map_err(|e| format!("Fail to convert response to JSON: {}", e))
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
