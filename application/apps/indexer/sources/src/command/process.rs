use crate::{sde, ByteSource, Error as SourceError, ReloadInfo, SourceFilter};
use async_trait::async_trait;
use buf_redux::Buffer;
use futures;
use regex::{Captures, Regex};
use shellexpand::tilde;
use std::{collections::HashMap, ffi::OsString, path::PathBuf, process::Stdio};
use thiserror::Error;
use tokio::{
    io::AsyncWriteExt,
    process::{Child, ChildStderr, ChildStdin, ChildStdout, Command},
    select,
};
use tokio_stream::StreamExt;
use tokio_util::codec::{self, FramedRead, LinesCodec};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

lazy_static! {
    static ref GROUP_RE: Regex =
        Regex::new(r#"".*?""#).expect("Regex must compile (fail with GROUP_RE)");
    static ref QUOTE_RE: Regex =
        Regex::new(r#"""#).expect("Regex must compile (fail with QUOTE_RE)");
    static ref ESC_RE: Regex = Regex::new(r"\\\s").expect("Regex must compile (fail with ESC_RE)");
}

#[derive(Error, Debug)]
pub enum ProcessError {
    #[error("{0}")]
    Setup(String),
    #[error("Unrecoverable process error: {0}")]
    Unrecoverable(String),
}

pub struct ProcessSource {
    process: Child,
    buffer: Buffer,
    stdout: FramedRead<ChildStdout, LinesCodec>,
    stderr: FramedRead<ChildStderr, LinesCodec>,
    stdin: ChildStdin,
}

impl Drop for ProcessSource {
    fn drop(&mut self) {
        if let Err(err) = futures::executor::block_on(self.process.kill()) {
            error!("Fail to kill child process: {err}");
        }
    }
}

impl ProcessSource {
    pub fn parse_command(command: &str) -> Result<Vec<OsString>, ProcessError> {
        let mut groups: Vec<String> = vec![];
        let parsed = ESC_RE.replace_all(command, "==esc_space==").to_string();
        let parsed = GROUP_RE.replace_all(&parsed, |caps: &Captures| {
            let index = groups.len();
            if caps.len() != 0 {
                let group = caps[0].to_string();
                groups.push(QUOTE_RE.replace_all(&group, "").to_string());
            }
            format!("==extraction:({index})==")
        });
        Ok(parsed
            .split(' ')
            .map(|a| {
                let mut str = a.to_string();
                for (i, g) in groups.iter().enumerate() {
                    let key = format!("==extraction:({i})==");
                    str.replace(&key, g).clone_into(&mut str);
                }
                let restored = str.replace("==esc_space==", " ");
                OsString::from(tilde(&restored).to_string())
            })
            .collect())
    }

    #[cfg(windows)]
    fn spawn(
        cmd: OsString,
        args: Vec<OsString>,
        cwd: PathBuf,
        envs: HashMap<String, String>,
    ) -> Result<Child, ProcessError> {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new(cmd)
            .args(args)
            .current_dir(OsString::from(cwd))
            .envs(envs)
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| ProcessError::Setup(format!("{e}")))
    }

    #[cfg(not(windows))]
    fn spawn(
        cmd: OsString,
        args: Vec<OsString>,
        cwd: PathBuf,
        envs: HashMap<String, String>,
    ) -> Result<Child, ProcessError> {
        Command::new(cmd)
            .args(args)
            .current_dir(OsString::from(cwd))
            .envs(envs)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| ProcessError::Setup(format!("{e}")))
    }

    pub async fn new(
        command: String,
        cwd: PathBuf,
        envs: HashMap<String, String>,
    ) -> Result<Self, ProcessError> {
        let mut args = ProcessSource::parse_command(&command)?;
        let cmd = if args.is_empty() {
            return Err(ProcessError::Setup(format!(
                "Not command has been found in \"{command}\""
            )));
        } else {
            args.remove(0)
        };
        let mut process = ProcessSource::spawn(cmd, args, cwd, envs)?;
        let stdout = codec::FramedRead::new(
            process
                .stdout
                .take()
                .ok_or_else(|| ProcessError::Setup(String::from("Fail to get stdout handle")))?,
            LinesCodec::default(),
        );
        let stderr = codec::FramedRead::new(
            process
                .stderr
                .take()
                .ok_or_else(|| ProcessError::Setup(String::from("Fail to get stderr handle")))?,
            LinesCodec::default(),
        );
        let stdin = process
            .stdin
            .take()
            .ok_or_else(|| ProcessError::Setup(String::from("Fail to get stdin handle")))?;
        Ok(Self {
            process,
            buffer: Buffer::new(),
            stdout,
            stderr,
            stdin,
        })
    }
}

#[async_trait]
impl ByteSource for ProcessSource {
    async fn reload(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        let mut closing = false;
        let mut output;
        loop {
            if !closing {
                output = select! {
                    res = self.stdout.next() => res,
                    res = self.stderr.next() => {
                        if res.is_none() {
                            closing = true;
                        }
                        res
                    },
                };
                if !closing {
                    break;
                }
            } else {
                output = self.stdout.next().await;
                break;
            }
        }
        if let Some(Ok(line)) = output {
            let stored = line.len() + 1;
            self.buffer.copy_from_slice(line.as_bytes());
            self.buffer.copy_from_slice(b"\n");
            Ok(Some(ReloadInfo::new(stored, stored, 0, None)))
        } else if let Some(Err(err)) = output {
            Err(SourceError::Unrecoverable(format!("{err}")))
        } else {
            Ok(None)
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

    async fn income(&mut self, request: sde::SdeRequest) -> Result<sde::SdeResponse, SourceError> {
        let bytes = match request {
            sde::SdeRequest::WriteText(ref str) => str.as_bytes(),
            sde::SdeRequest::WriteBytes(ref bytes) => bytes,
        };
        self.stdin.write_all(bytes).await.map_err(SourceError::Io)?;
        Ok(sde::SdeResponse { bytes: bytes.len() })
    }
}

#[tokio::test]
async fn test_process() -> Result<(), ProcessError> {
    use std::env;
    let mut command = "";
    if cfg!(windows) {
        command = "help";
    } else if cfg!(unix) {
        command = "ls -lsa";
    }
    let envs = HashMap::new();
    match ProcessSource::new(command.to_string(), env::current_dir().unwrap(), envs).await {
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
            // By some reasons during test sometimes process stay alive and as result
            let _ = process_source.process.kill().await;
            Ok(())
        }
        Err(err) => Err(err),
    }
}

#[tokio::test]
async fn test_parsing() -> Result<(), ProcessError> {
    let parsed = ProcessSource::parse_command(r#"cmd arg2 "some_path/with space or spaces" arg3"#)?;
    assert_eq!(parsed.len(), 4);
    assert_eq!(parsed[0], OsString::from("cmd"));
    assert_eq!(parsed[1], OsString::from("arg2"));
    assert_eq!(parsed[2], OsString::from("some_path/with space or spaces"));
    assert_eq!(parsed[3], OsString::from("arg3"));
    let parsed = ProcessSource::parse_command(r"cmd arg2 some_path/with\ space\ or\ spaces arg3")?;
    assert_eq!(parsed.len(), 4);
    assert_eq!(parsed[0], OsString::from("cmd"));
    assert_eq!(parsed[1], OsString::from("arg2"));
    assert_eq!(parsed[2], OsString::from("some_path/with space or spaces"));
    assert_eq!(parsed[3], OsString::from("arg3"));
    Ok(())
}
