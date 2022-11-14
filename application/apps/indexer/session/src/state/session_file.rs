use super::observing::Observing;
use crate::{
    events::{NativeError, NativeErrorKind},
    paths,
    state::GrabbedElement,
};
use indexer_base::progress::Severity;
use log::debug;
use processor::{
    grabber::{Grabber, LineRange},
    text_source::TextFileSource,
};
use std::{
    fs::File,
    io::{BufWriter, Write},
    path::PathBuf,
    time::Instant,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub const NOTIFY_IN_MS: u128 = 250;

#[derive(Debug)]
pub enum SessionFileState {
    Changed,
    MaybeChanged,
    NoChanges,
}

#[derive(Debug)]
pub struct SessionFile {
    pub grabber: Option<Box<Grabber>>,
    pub filename: Option<PathBuf>,
    pub writer: Option<BufWriter<File>>,
    pub last_message_timestamp: Instant,
    pub has_updates: bool,
    pub observing: Observing,
}

impl SessionFile {
    pub fn new() -> Self {
        SessionFile {
            grabber: None,
            filename: None,
            writer: None,
            last_message_timestamp: Instant::now(),
            has_updates: false,
            observing: Observing::new(),
        }
    }

    pub fn init(&mut self, mut filename: Option<PathBuf>) -> Result<(), NativeError> {
        if self.grabber.is_none() {
            let filename = if let Some(filename) = filename.take() {
                filename
            } else {
                let streams = paths::get_streams_dir()?;
                let filename = streams.join(format!("{}.session", Uuid::new_v4()));
                debug!("Session file setup: {}", filename.to_string_lossy());
                self.writer = Some(BufWriter::new(File::create(&filename).map_err(|e| {
                    NativeError {
                        severity: Severity::ERROR,
                        kind: NativeErrorKind::Io,
                        message: Some(format!(
                            "Fail to create session writer for {}: {}",
                            filename.to_string_lossy(),
                            e
                        )),
                    }
                })?));
                filename
            };
            self.filename = Some(filename.clone());
            Ok(Grabber::lazy(TextFileSource::new(&filename))
                .map(|g| self.grabber = Some(Box::new(g)))?)
        } else {
            Ok(())
        }
    }

    #[allow(clippy::len_without_is_empty)]
    pub fn len(&mut self) -> usize {
        if let Some(ref grabber) = self.grabber {
            if let Some(md) = grabber.get_metadata() {
                md.line_count
            } else {
                0
            }
        } else {
            0
        }
    }

    pub async fn write(
        &mut self,
        source_id: u8,
        state_cancellation_token: CancellationToken,
        msg: String,
    ) -> Result<SessionFileState, NativeError> {
        if !self.observing.is_source_same(source_id) {
            self.flush(state_cancellation_token.clone()).await?;
        }
        if let Some(writer) = &mut self.writer {
            writer.write_all(msg.as_bytes())?;
            self.observing.source_update(source_id);
            if self.last_message_timestamp.elapsed().as_millis() > NOTIFY_IN_MS {
                self.flush(state_cancellation_token.clone()).await
            } else {
                self.has_updates = true;
                Ok(SessionFileState::MaybeChanged)
            }
        } else {
            Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(String::from(
                    "Session file isn't assigned yet, cannot flush",
                )),
            })
        }
    }

    pub async fn flush(
        &mut self,
        state_cancellation_token: CancellationToken,
    ) -> Result<SessionFileState, NativeError> {
        if !self.has_updates {
            return Ok(SessionFileState::NoChanges);
        }
        if let Some(writer) = &mut self.writer {
            writer.flush()?;
            self.last_message_timestamp = Instant::now();
            self.has_updates = false;
            self.update(
                self.observing.get_recent_source_id(),
                state_cancellation_token,
            )
            .await
        } else {
            Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(String::from(
                    "Session file isn't assigned yet, cannot flush",
                )),
            })
        }
    }

    pub async fn update(
        &mut self,
        source_id: u8,
        state_cancellation_token: CancellationToken,
    ) -> Result<SessionFileState, NativeError> {
        let grabber = &mut (self.grabber.as_mut().ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(String::from("Grabber isn't inited")),
        })?);
        let prev = grabber.log_entry_count().unwrap_or(0) as u64;
        if let Some(range) = grabber.update_from_file(Some(state_cancellation_token))? {
            self.observing.add_range(range, source_id);
        }
        let current = grabber.log_entry_count().unwrap_or(0) as u64;
        Ok(if prev != current {
            SessionFileState::Changed
        } else {
            SessionFileState::NoChanges
        })
    }

    pub fn grab(&self, range: &LineRange) -> Result<Vec<GrabbedElement>, NativeError> {
        let grabber = &mut (self.grabber.as_ref().ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(String::from("Grabber isn't inited")),
        })?);
        let rows = grabber.grab_content(range).map_err(|e| NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(format!("{e}")),
        })?;
        let mapped_ranges = self.observing.get_mapped_ranges(&range.range);
        let from = *range.range.start() as usize;
        Ok(rows
            .into_iter()
            .enumerate()
            .map(|(i, content)| {
                let pos = from + i;
                GrabbedElement {
                    source_id: mapped_ranges.source(pos as u64).unwrap_or(0),
                    content,
                    pos,
                    row: pos,
                }
            })
            .collect())
    }

    pub fn filename(&self) -> Result<PathBuf, NativeError> {
        if let Some(filename) = self.filename.as_ref() {
            Ok(filename.clone())
        } else {
            Err(NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(String::from("Session file isn't created yet")),
            })
        }
    }

    pub fn copy_content<W: std::io::Write>(
        &mut self,
        writer: &mut W,
        line_range: &LineRange,
    ) -> Result<(), NativeError> {
        let grabber = &mut (self.grabber.as_ref().ok_or(NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Grabber,
            message: Some(String::from("Grabber isn't inited")),
        })?);
        grabber
            .copy_content(writer, line_range)
            .map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Grabber,
                message: Some(format!("{e}")),
            })
    }

    pub fn cleanup(&mut self) -> Result<(), NativeError> {
        if self.writer.is_none() {
            return Ok(());
        }
        let filename = self.filename()?;
        debug!("cleaning up files: {:?}", filename);
        if filename.exists() {
            std::fs::remove_file(filename).map_err(|e| NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::Io,
                message: Some(e.to_string()),
            })?;
        }
        Ok(())
    }
}

impl Default for SessionFile {
    fn default() -> Self {
        Self::new()
    }
}
