use crate::{
    command::sde::{SdeRequest, SdeResponse, WriteResponse},
    ByteSource, Error as SourceError, ReloadInfo, SourceFilter,
};
use async_trait::async_trait;
use buf_redux::Buffer;
use std::{collections::HashMap, process::Stdio};
use thiserror::Error;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, BufWriter},
    process::{Child, ChildStderr, ChildStdin, ChildStdout, Command},
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
    stdin_writer: Option<BufWriter<ChildStdin>>,
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
                .stdin(Stdio::piped())
                .spawn()
                .map_err(|e| ProcessError::Setup(format!("{}", e)))?,
            buffer: Buffer::new(),
            amount: 0,
            stdout_reader: None,
            stderr_reader: None,
            stdin_writer: None,
        })
    }
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
                            Ok(_) => {
                                Ok(stdout_buffer)
                            },
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
                            Ok(_) => {
                                Ok(stderr_buffer)
                            },
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
        let request = serde_json::from_str::<SdeRequest>(&msg)
            .map_err(|e| format!("Fail to deserialize message: {}", e))?;
        if self.stdin_writer.is_none() {
            match self.process.stdin.take() {
                Some(stdin) => self.stdin_writer = Some(BufWriter::new(stdin)),
                None => return Err(String::from("No stdin available")),
            }
        }
        let response = if let Some(writer) = self.stdin_writer.as_mut() {
            let response = match request {
                SdeRequest::WriteText(str) => {
                    let written = writer
                        .write(str.as_bytes())
                        .await
                        .map_err(|e| format!("Fail to write string into stdin: {}", e))?;
                    SdeResponse::WriteText(WriteResponse { bytes: written })
                }
                SdeRequest::WriteBytes(bytes) => {
                    let written = writer
                        .write(&bytes)
                        .await
                        .map_err(|e| format!("Fail to write bytes into stdin: {}", e))?;
                    SdeResponse::WriteText(WriteResponse { bytes: written })
                }
            };
            writer
                .flush()
                .await
                .map_err(|e| format!("Fail to write string into stdin: {}", e))?;
            response
        } else {
            SdeResponse::Error(String::from("No access to stdin"))
        };
        serde_json::to_string(&response)
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
