use crate::ByteSource;
use crate::{Error as SourceError, ReloadInfo, SourceFilter};
use async_trait::async_trait;
use buf_redux::Buffer;
use std::collections::HashMap;
use std::process::Output;
use std::time::Duration;
use thiserror::Error;
use tokio::process::Command;

const TIMEOUT: u64 = 100;

#[derive(Error, Debug)]
pub enum ProcessError {
    #[error("Process setup problem: {0}")]
    Setup(String),
    #[error("Unrecoverable process error: {0}")]
    Unrecoverable(String),
}

pub struct ProcessSource {
    output: Result<Output, ProcessError>,
    buffer: Buffer,
    amount: usize,
}

impl ProcessSource {
    pub async fn new(
        command: &str,
        args: Vec<&str>,
        envs: HashMap<&str, &str>,
    ) -> Result<Self, ProcessError> {
        Ok(Self {
            output: Command::new(command)
                .args(args)
                .envs(envs)
                .output()
                .await
                .map_err(|e| ProcessError::Setup(format!("{}", e))),
            buffer: Buffer::new(),
            amount: 0,
        })
    }
}

#[async_trait]
impl ByteSource for ProcessSource {
    async fn reload(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        let mut copied: usize = 0;
        let mut buffer_error: String = "".to_string();
        let timeout = tokio::time::timeout(Duration::from_millis(TIMEOUT), async {
            match &self.output.as_ref() {
                Ok(output) => copied += self.buffer.copy_from_slice(&output.stdout),
                Err(err) => buffer_error = format!("reading from buffer failed: {}", err),
            };
        })
        .await;
        if timeout.is_err() {
            Ok(Some(ReloadInfo::new(0, 0, 0, None)))
        } else if buffer_error.is_empty() {
            self.amount = copied;
            Ok(Some(ReloadInfo::new(self.amount, self.amount, 0, None)))
        } else {
            Err(SourceError::Unrecoverable(buffer_error))
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
}

#[tokio::test]
async fn test_process() -> Result<(), ProcessError> {
    let command = "echo";
    let args = ["one two three"];
    let mut envs = HashMap::new();
    if cfg!(windows) {
        envs.insert("Path", "%USERPROFILE%");
    } else if cfg!(unix) {
        envs.insert("$PATH", "~");
    }

    match ProcessSource::new(command, args.to_vec(), envs).await {
        Ok(mut process_source) => {
            for arg in args {
                let formatted_arg = format!("{}\n", arg);
                if let Err(err) = process_source.reload(None).await {
                    return Err(ProcessError::Unrecoverable(format!(
                        "reload failed: {}",
                        err
                    )));
                }
                assert_eq!(process_source.current_slice(), formatted_arg.as_bytes());
                process_source.consume(arg.len());
            }
            Ok(())
        }
        Err(err) => Err(err),
    }
}
