use super::source_ids::SourceIDs;
use crate::paths;
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
use stypes::GrabbedElement;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub const FLUSH_DATA_IN_MS: u128 = 500;
pub const SESSION_FILE_EXTENSION: &str = "session";

#[derive(Debug)]
pub enum SessionFileState {
    Changed,
    MaybeChanged,
    NoChanges,
}

#[derive(Debug, Clone)]
pub enum SessionFileOrigin {
    Linked(PathBuf),
    Generated(PathBuf),
}

impl SessionFileOrigin {
    pub fn filename(&self) -> PathBuf {
        match self {
            Self::Linked(filename) => filename,
            Self::Generated(filename) => filename,
        }
        .clone()
    }

    pub fn is_linked(&self) -> bool {
        matches!(self, Self::Linked(_))
    }
}

#[derive(Debug)]
pub struct SessionFile {
    pub grabber: Option<Box<Grabber>>,
    pub filename: Option<SessionFileOrigin>,
    pub writer: Option<BufWriter<File>>,
    pub last_message_timestamp: Instant,
    pub sources: SourceIDs,
}

impl SessionFile {
    pub fn new() -> Self {
        SessionFile {
            grabber: None,
            filename: None,
            writer: None,
            last_message_timestamp: Instant::now(),
            sources: SourceIDs::new(),
        }
    }

    pub fn init(&mut self, mut filename: Option<PathBuf>) -> Result<(), stypes::NativeError> {
        if self.grabber.is_none() {
            let filename = if let Some(filename) = filename.take() {
                self.filename = Some(SessionFileOrigin::Linked(filename.clone()));
                filename
            } else {
                let streams = paths::get_streams_dir()?;
                let filename = streams.join(format!("{}.{SESSION_FILE_EXTENSION}", Uuid::new_v4()));
                debug!("Session file setup: {}", filename.to_string_lossy());
                self.writer = Some(BufWriter::new(File::create(&filename).map_err(|e| {
                    stypes::NativeError {
                        severity: stypes::Severity::ERROR,
                        kind: stypes::NativeErrorKind::Io,
                        message: Some(format!(
                            "Fail to create session writer for {}: {}",
                            filename.to_string_lossy(),
                            e
                        )),
                    }
                })?));
                self.filename = Some(SessionFileOrigin::Generated(filename.clone()));
                filename
            };
            Ok(Grabber::lazy(TextFileSource::new(&filename))
                .map(|g| self.grabber = Some(Box::new(g)))?)
        } else {
            Ok(())
        }
    }

    #[allow(clippy::len_without_is_empty)]
    pub fn len(&mut self) -> u64 {
        if let Some(ref grabber) = self.grabber {
            if let Some(md) = grabber.get_metadata() {
                md.line_count as u64
            } else {
                0
            }
        } else {
            0
        }
    }

    /// Returns amount of bytes, which was processed by grabber
    pub fn read_bytes(&mut self) -> u64 {
        if let Some(ref grabber) = self.grabber {
            if let Some(md) = grabber.get_metadata() {
                if let Some(slot) = md.slots.last() {
                    slot.bytes.end()
                } else {
                    0
                }
            } else {
                0
            }
        } else {
            0
        }
    }

    pub fn write(
        &mut self,
        source_id: u16,
        state_cancellation_token: CancellationToken,
        msg: String,
    ) -> Result<SessionFileState, stypes::NativeError> {
        if !self.sources.is_source_same(source_id) {
            self.flush(state_cancellation_token.clone(), false)?;
        }
        if let Some(writer) = &mut self.writer {
            writer.write_all(msg.as_bytes())?;
            self.sources.source_update(source_id);
            if self.last_message_timestamp.elapsed().as_millis() > FLUSH_DATA_IN_MS {
                self.flush(state_cancellation_token, true)
            } else {
                Ok(SessionFileState::MaybeChanged)
            }
        } else {
            Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(String::from(
                    "Session file isn't assigned yet, cannot flush",
                )),
            })
        }
    }

    pub fn flush(
        &mut self,
        state_cancellation_token: CancellationToken,
        drop_timestamp: bool,
    ) -> Result<SessionFileState, stypes::NativeError> {
        if drop_timestamp {
            self.last_message_timestamp = Instant::now();
        }
        if let Some(writer) = &mut self.writer {
            writer.flush()?;
            self.update(
                self.sources.get_recent_source_id(),
                state_cancellation_token,
            )
        } else {
            Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(String::from(
                    "Session file isn't assigned yet, cannot flush",
                )),
            })
        }
    }

    pub fn update(
        &mut self,
        source_id: u16,
        state_cancellation_token: CancellationToken,
    ) -> Result<SessionFileState, stypes::NativeError> {
        let grabber = &mut (self.grabber.as_mut().ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Grabber,
            message: Some(String::from("Grabber isn't inited")),
        })?);
        let prev = grabber.log_entry_count().unwrap_or(0) as u64;
        if let Some(range) = grabber.update_from_file(Some(state_cancellation_token))? {
            self.sources.add_range(range, source_id);
        }
        let current = grabber.log_entry_count().unwrap_or(0) as u64;
        Ok(if prev != current {
            SessionFileState::Changed
        } else {
            SessionFileState::NoChanges
        })
    }

    pub fn grab(&self, range: &LineRange) -> Result<Vec<GrabbedElement>, stypes::NativeError> {
        let grabber = &mut (self.grabber.as_ref().ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Grabber,
            message: Some(String::from("Grabber isn't inited")),
        })?);
        let rows = grabber
            .grab_content(range)
            .map_err(|e| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!("{e}")),
            })?;
        let mapped_ranges = self.sources.get_mapped_ranges(&range.range);
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
                    nature: 0,
                }
            })
            .collect())
    }

    pub fn filename(&self) -> Result<PathBuf, stypes::NativeError> {
        if let Some(origin) = self.filename.as_ref() {
            Ok(origin.filename())
        } else {
            Err(stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(String::from("Session file isn't created yet")),
            })
        }
    }

    /// Copies a specified range of lines from the source to the provided writer.
    ///
    /// `modifier` can be used to modify content before writing; for example it can be used to
    /// exclude some content during exporting (write selected columns only)
    ///
    /// # Arguments
    ///
    /// * `writer` - This is where the copied content will be written.
    /// * `line_range` - A reference to a `LineRange` struct that specifies the range of lines
    ///   to be copied from the source.
    /// * `modifier` - An optional function that takes a `String` as input and returns a modified
    ///   `String`. If provided, this function will be applied to each line before
    ///   writing it to the writer.
    ///
    /// # Returns
    ///
    /// * `Result<(), stypes::NativeError>`:
    ///     * `Ok(())` if the content is copied successfully.
    ///     * `Err(stypes::NativeError)` if an error occurs during the copying process.
    ///
    pub fn copy_content<W: std::io::Write>(
        &mut self,
        writer: &mut W,
        line_range: &LineRange,
        modifier: Option<impl Fn(String) -> String>,
    ) -> Result<(), stypes::NativeError> {
        let grabber = &mut (self.grabber.as_ref().ok_or(stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Grabber,
            message: Some(String::from("Grabber isn't inited")),
        })?);
        grabber
            .copy_content(writer, line_range, modifier)
            .map_err(|e| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Grabber,
                message: Some(format!("{e}")),
            })
    }

    /// Cleans up the temporary generated files and for the session on its attachments if exist
    /// for none-linked sessions.
    pub fn cleanup(&mut self) -> Result<(), stypes::NativeError> {
        if self.writer.is_none() {
            // Session is linked. No temporary files has been generated.
            return Ok(());
        }

        // Remove session main file.
        let filename = self.filename()?;
        debug!("cleaning up files: {filename:?}");
        if filename.exists() {
            std::fs::remove_file(&filename).map_err(|e| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Io,
                message: Some(format!(
                    "Removing session main file fialed. Error: {e}. Path: {}",
                    filename.display()
                )),
            })?;
        }

        // Remove attachments directory if exists.
        let attachments_dir = filename
            .to_str()
            .and_then(|file| file.strip_suffix(&format!(".{SESSION_FILE_EXTENSION}")))
            .map(PathBuf::from)
            .ok_or_else(|| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Io,
                message: Some("Session file name isn't UTF-8 valid".into()),
            })?;

        if attachments_dir.exists() {
            debug!(
                "Cleaning up attachments direcotry: {}",
                attachments_dir.display()
            );

            std::fs::remove_dir_all(&attachments_dir).map_err(|err| stypes::NativeError {
                severity: stypes::Severity::ERROR,
                kind: stypes::NativeErrorKind::Io,
                message: Some(format!(
                    "Removing attachments directory failed. Error: {err}, Path: {}",
                    attachments_dir.display()
                )),
            })?
        }

        Ok(())
    }
}

impl Default for SessionFile {
    fn default() -> Self {
        Self::new()
    }
}
