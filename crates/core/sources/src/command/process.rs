//! Byte source over the output of a spawned shell command.
//!
//! Stdout and stderr are handed over as raw bytes: framing and decoding belong to the parser.
//! Stdin serves the session's send-data-to-source requests.

use crate::{ByteSource, Error as SourceError, ReloadInfo, STREAM_BUFFER_CAPACITY, SourceFilter};
use bufread::DeqBuffer;
use std::{ffi::OsString, path::PathBuf, process::Stdio};
use stypes::ShellProfile;
use thiserror::Error;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    process::{Child, ChildStderr, ChildStdin, ChildStdout, Command},
    select,
};

#[derive(Error, Debug)]
pub enum ProcessError {
    #[error("{0}")]
    Setup(String),
    #[error("Unrecoverable process error: {0}")]
    Unrecoverable(String),
}

/// Reads the output of a child process, spawned through the user's shell.
pub struct ProcessSource {
    process: Child,
    buffer: DeqBuffer,
    stdout: ChildStdout,
    stderr: ChildStderr,
    stdin: ChildStdin,
    /// Destination of a read from stdout. Both streams are read concurrently, so they can't share
    /// one destination, and a local one would have to be zeroed on every `load()` call.
    stdout_chunk: Vec<u8>,
    /// Destination of a read from stderr, see [`ProcessSource::stdout_chunk`].
    stderr_chunk: Vec<u8>,
    /// Whether stderr has reached its end. An ended stream stays ready with zero bytes forever,
    /// so it has to be dropped from the `select!` instead of being polled again on every load.
    stderr_ended: bool,
}

/// Which of the child's output streams delivered the bytes of a read.
#[derive(Clone, Copy)]
enum ChildOutput {
    Stdout,
    Stderr,
}

impl Drop for ProcessSource {
    fn drop(&mut self) {
        let is_process_alive = self.process.try_wait().is_ok_and(|state| state.is_none());
        if is_process_alive {
            let _ = self.process.start_kill().inspect_err(|err| {
                warn!("Fail to kill child process: {err}");
            });
        }
    }
}

impl ProcessSource {
    #[cfg(windows)]
    fn spawn(
        command: &str,
        cwd: PathBuf,
        shell: Option<ShellProfile>,
    ) -> Result<Child, ProcessError> {
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let (bin, cmd_arg) = shell
            .map(|sh| (sh.path.as_os_str().to_os_string(), sh.shell.command_arg()))
            // Check if built-in PowerShell is installed in use it as default shell.
            .or_else(|| {
                shell_tools::get_win_powershell().map(|p| {
                    (
                        p.as_os_str().to_os_string(),
                        stypes::ShellType::Pwsh.command_arg(),
                    )
                })
            })
            .unwrap_or_else(|| (OsString::from("cmd"), "/C"));

        Command::new(bin)
            .arg(cmd_arg)
            .arg(command)
            .current_dir(OsString::from(cwd))
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
        command: &str,
        cwd: PathBuf,
        shell: Option<ShellProfile>,
    ) -> Result<Child, ProcessError> {
        let (bin, cmd_arg) = shell
            .map(|sh| (sh.path.as_os_str().to_os_string(), sh.shell.command_arg()))
            .unwrap_or_else(|| (OsString::from("sh"), "-c"));
        Command::new(bin)
            .arg(cmd_arg)
            .arg(command)
            .current_dir(OsString::from(cwd))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| ProcessError::Setup(format!("{e}")))
    }

    /// Spawns `command` in `cwd`, using the given shell or the platform default one.
    ///
    /// # Panics
    ///
    /// Panics when called outside a tokio runtime, since the child's pipes are registered with
    /// the reactor on spawn.
    pub fn new(
        command: String,
        cwd: PathBuf,
        shell: Option<ShellProfile>,
    ) -> Result<Self, ProcessError> {
        /// Maximum number of bytes a single read takes from the child's stdout or stderr.
        const READ_CHUNK_SIZE: usize = 8 * 1024;

        Self::with_sizes(command, cwd, shell, STREAM_BUFFER_CAPACITY, READ_CHUNK_SIZE)
    }

    /// Spawns the command with explicit buffer sizes, so tests can reach the paths that only
    /// happen once the buffer is full without producing megabytes of output.
    fn with_sizes(
        command: String,
        cwd: PathBuf,
        shell: Option<ShellProfile>,
        buffer_capacity: usize,
        read_size: usize,
    ) -> Result<Self, ProcessError> {
        let mut process = ProcessSource::spawn(&command, cwd, shell)?;
        let stdout = process
            .stdout
            .take()
            .ok_or_else(|| ProcessError::Setup(String::from("Fail to get stdout handle")))?;
        let stderr = process
            .stderr
            .take()
            .ok_or_else(|| ProcessError::Setup(String::from("Fail to get stderr handle")))?;
        let stdin = process
            .stdin
            .take()
            .ok_or_else(|| ProcessError::Setup(String::from("Fail to get stdin handle")))?;
        Ok(Self {
            process,
            buffer: DeqBuffer::new(buffer_capacity),
            stdout,
            stderr,
            stdin,
            stdout_chunk: vec![0; read_size],
            stderr_chunk: vec![0; read_size],
            stderr_ended: false,
        })
    }
}

impl ByteSource for ProcessSource {
    async fn load(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        // Space freed by the consumer sits in front of the buffered bytes and is reachable by
        // compacting only: without this a retained partial line would shrink every following read
        // until the buffer looks full while being mostly empty.
        if !self.buffer.ensure_write_space(1) {
            // Nothing in the buffer has been consumed yet, so there is nowhere to read into. The
            // producer resolves this by parsing what is buffered.
            let available_bytes = self.buffer.read_available();
            let info = ReloadInfo::new(0, available_bytes, 0, None);

            return Ok(Some(info));
        }
        // Reading more than fits would lose bytes: they are gone from the pipe, and `write_from`
        // drops silently what it can't store.
        let read_size = self.buffer.write_available().min(self.stdout_chunk.len());

        // Implementation is cancel-safe here because `read()` takes nothing from the stream when
        // its future is dropped, and no data is gathered between two await calls: the bytes are
        // copied into the buffer after the last one. The only multiple await calls here are
        // actually on the turn stderr ends, where it has no data to lose anyway.
        let (stream, len) = loop {
            if self.stderr_ended {
                let len = self
                    .stdout
                    .read(&mut self.stdout_chunk[..read_size])
                    .await
                    .map_err(SourceError::Io)?;

                break (ChildOutput::Stdout, len);
            }

            let read = select! {
                res = self.stdout.read(&mut self.stdout_chunk[..read_size]) => {
                    (ChildOutput::Stdout, res.map_err(SourceError::Io)?)
                },
                res = self.stderr.read(&mut self.stderr_chunk[..read_size]) => {
                    (ChildOutput::Stderr, res.map_err(SourceError::Io)?)
                },
            };

            // An ended stderr stays ready with zero bytes forever: keep waiting on stdout alone
            // instead of spinning on it.
            if matches!(read, (ChildOutput::Stderr, 0)) {
                self.stderr_ended = true;
                continue;
            }

            break read;
        };

        if len == 0 {
            // Only stdout can get here, and its end is the end of this source.
            return Ok(None);
        }

        // The read was capped by the free space, so `write_from` stores all of it. Its return
        // value is still the only honest `newly_loaded_bytes`: a reported byte that never made it
        // into the buffer tells the producer that progress happened and makes it ask forever.
        let written = match stream {
            ChildOutput::Stdout => self.buffer.write_from(&self.stdout_chunk[..len]),
            ChildOutput::Stderr => self.buffer.write_from(&self.stderr_chunk[..len]),
        };
        let available_bytes = self.buffer.read_available();
        let info = ReloadInfo::new(written, available_bytes, 0, None);

        Ok(Some(info))
    }

    fn can_buffer_more(&self) -> bool {
        // `load()` compacts before reading, so the space in front of the buffered bytes counts.
        self.buffer.spare_capacity() > 0
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
        match ProcessSource::new(command.to_string(), env::current_dir().unwrap(), None) {
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
    async fn test_source_reload() {
        use std::env;
        let mut command = "";
        if cfg!(windows) {
            command = "help";
        } else if cfg!(unix) {
            command = "ls -lsa";
        }
        // Sizes small enough that the short output of the command spans several loads: with the
        // production read size the first load takes all of it and the second one hits the end of
        // stdout, which the shared test doesn't expect.
        const BUFFER_CAPACITY: usize = 256;
        const READ_SIZE: usize = 16;

        let mut process_source = ProcessSource::with_sizes(
            command.to_string(),
            env::current_dir().unwrap(),
            None,
            BUFFER_CAPACITY,
            READ_SIZE,
        )
        .unwrap();

        general_source_reload_test(&mut process_source).await;
    }

    /// Output reaches the parser as the child wrote it: bytes that are not valid UTF-8 no longer
    /// end the session with a decoding error, and unterminated output no longer gets the line
    /// break that framing used to synthesize.
    #[cfg(unix)]
    #[tokio::test]
    async fn output_is_delivered_unchanged() {
        // 0xF1 is `ñ` in the Windows-1252 sample of the user report, and there is no trailing
        // newline.
        let mut source = ProcessSource::new(
            "printf 'a\\361b'".to_string(),
            std::env::current_dir().unwrap(),
            None,
        )
        .unwrap();

        let mut received = Vec::new();
        while source.load(None).await.unwrap().is_some() {
            received.extend_from_slice(source.current_slice());
            source.consume(source.current_slice().len());
        }

        assert_eq!(received, b"a\xF1b");
    }

    /// A line longer than the buffer cannot be stored in full. Every `ReloadInfo` must report what
    /// the buffer actually took, and a full buffer must report no progress instead of reading
    /// bytes that have nowhere to go.
    #[cfg(unix)]
    #[tokio::test]
    async fn long_line_reports_only_buffered_bytes() {
        const BUFFER_CAPACITY: usize = 512;
        const READ_SIZE: usize = 64;

        // POSIX `printf` width: 20000 spaces followed by a newline, one line far longer than the
        // buffer.
        let mut source = ProcessSource::with_sizes(
            "printf '%20000s\\n' ''".to_string(),
            std::env::current_dir().unwrap(),
            None,
            BUFFER_CAPACITY,
            READ_SIZE,
        )
        .unwrap();

        while source.can_buffer_more() {
            let buffered_before = source.current_slice().len();
            let info = source.load(None).await.unwrap().unwrap();

            assert_eq!(
                info.newly_loaded_bytes,
                source.current_slice().len() - buffered_before
            );
            assert_eq!(info.available_bytes, source.current_slice().len());
        }

        let info = source.load(None).await.unwrap().unwrap();

        assert_eq!(info.newly_loaded_bytes, 0);
        assert_eq!(info.available_bytes, BUFFER_CAPACITY);
    }
}
