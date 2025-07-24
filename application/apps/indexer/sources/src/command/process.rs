use bufread::DeqBuffer;
use components::{ComponentDescriptor, MetadataDescriptor};
use definitions::*;
use regex::{Captures, Regex};
use shellexpand::tilde;
use std::{collections::HashMap, ffi::OsString, io::Read, path::PathBuf, process::Stdio};
use stypes::SourceOrigin;
use thiserror::Error;
use tokio::{
    io::AsyncWriteExt,
    process::{Child, ChildStderr, ChildStdin, ChildStdout, Command},
    select,
};
use tokio_stream::StreamExt;
use tokio_util::codec::{self, FramedRead, LinesCodec};

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
    buffer: DeqBuffer,
    stdout: FramedRead<ChildStdout, LinesCodec>,
    stderr: FramedRead<ChildStderr, LinesCodec>,
    stdin: ChildStdin,
}

impl Drop for ProcessSource {
    fn drop(&mut self) {
        let is_process_alive = self.process.try_wait().is_ok_and(|state| state.is_none());
        if is_process_alive {
            if let Err(err) = self.process.start_kill() {
                warn!("Fail to kill child process: {err}");
            }
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
            buffer: DeqBuffer::new(8192),
            stdout,
            stderr,
            stdin,
        })
    }
}

impl ByteSource for ProcessSource {
    async fn load(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        let mut closing = false;
        let mut output;
        // Implementation is cancel-safe here because there is no data gathered between to await
        // calls. The only multiple await calls here, are actually while closing where there is
        // no data to lose anyway.
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
            self.buffer.write_from(line.as_bytes());
            self.buffer.write_from(b"\n");
            let available_bytes = self.buffer.read_available();
            Ok(Some(ReloadInfo::new(stored, available_bytes, 0, None)))
        } else if let Some(Err(err)) = output {
            Err(SourceError::Unrecoverable(format!("{err}")))
        } else {
            Ok(None)
        }
    }

    fn current_slice(&self) -> &[u8] {
        self.buffer.read_slice()
    }

    fn consume(&mut self, offset: usize) {
        self.buffer.read_done(offset);
    }

    fn len(&self) -> usize {
        self.buffer.read_available()
    }

    fn is_empty(&self) -> bool {
        self.len() == 0
    }

    async fn income(
        &mut self,
        request: stypes::SdeRequest,
    ) -> Result<stypes::SdeResponse, SourceError> {
        let bytes = match request {
            stypes::SdeRequest::WriteText(ref str) => str.as_bytes(),
            stypes::SdeRequest::WriteBytes(ref bytes) => bytes,
        };
        self.stdin.write_all(bytes).await.map_err(SourceError::Io)?;
        Ok(stypes::SdeResponse { bytes: bytes.len() })
    }
}

const TERM_SOURCE_UUID: uuid::Uuid = uuid::Uuid::from_bytes([
    0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07, 0x07,
]);

#[derive(Default)]
pub struct Descriptor {}

impl ComponentDescriptor<crate::Source> for Descriptor {
    fn create(
        &self,
        _origin: &SourceOrigin,
        _options: &[stypes::Field],
    ) -> Result<Option<crate::Source>, stypes::NativeError> {
        Ok(None)
    }
}

impl MetadataDescriptor for Descriptor {
    fn is_compatible(&self, origin: &SourceOrigin) -> bool {
        match origin {
            SourceOrigin::File(..)
            | SourceOrigin::Files(..)
            | SourceOrigin::Folder(..)
            | SourceOrigin::Folders(..) => false,
            SourceOrigin::Source => true,
        }
    }
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("Terminal Source"),
            desc: String::from("Terminal Source"),
            uuid: TERM_SOURCE_UUID,
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Source
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::general_source_reload_test;

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
                    .load(None)
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
        let parsed =
            ProcessSource::parse_command(r#"cmd arg2 "some_path/with space or spaces" arg3"#)?;
        assert_eq!(parsed.len(), 4);
        assert_eq!(parsed[0], OsString::from("cmd"));
        assert_eq!(parsed[1], OsString::from("arg2"));
        assert_eq!(parsed[2], OsString::from("some_path/with space or spaces"));
        assert_eq!(parsed[3], OsString::from("arg3"));
        let parsed =
            ProcessSource::parse_command(r"cmd arg2 some_path/with\ space\ or\ spaces arg3")?;
        assert_eq!(parsed.len(), 4);
        assert_eq!(parsed[0], OsString::from("cmd"));
        assert_eq!(parsed[1], OsString::from("arg2"));
        assert_eq!(parsed[2], OsString::from("some_path/with space or spaces"));
        assert_eq!(parsed[3], OsString::from("arg3"));
        Ok(())
    }

    #[tokio::test]
    async fn test_source_reload() {
        use std::env;
        let mut command = "";
        if cfg!(windows) {
            command = "help";
        } else if cfg!(unix) {
            command = "ls -lsa";
        }
        let envs = HashMap::new();
        let mut process_source =
            ProcessSource::new(command.to_string(), env::current_dir().unwrap(), envs)
                .await
                .unwrap();

        general_source_reload_test(&mut process_source).await;
    }
}
