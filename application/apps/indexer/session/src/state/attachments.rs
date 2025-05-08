use mime_guess;
use std::{
    collections::HashMap,
    fs::{create_dir, File},
    io,
    io::Write,
    path::{Path, PathBuf},
};
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum AttachmentsError {
    #[error("Save error: {0}")]
    Save(String),
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
    #[error("Session isn't created")]
    SessionNotCreated,
}

impl From<AttachmentsError> for stypes::NativeError {
    fn from(err: AttachmentsError) -> Self {
        stypes::NativeError {
            severity: stypes::Severity::ERROR,
            kind: stypes::NativeErrorKind::Io,
            message: Some(err.to_string()),
        }
    }
}

const FILE_NAME_INDEXES_LIMIT: usize = 1000;
const ALLOWED_FILENAME_CHARS: &[char] = &['-', '_'];

fn get_valid_file_path(dest: &Path, origin: &str) -> Result<PathBuf, io::Error> {
    fn sanitize<S: AsRef<str>>(input: S) -> String {
        input
            .as_ref()
            .chars()
            .map(|ch| {
                if ch.is_alphanumeric() || ALLOWED_FILENAME_CHARS.contains(&ch) {
                    ch
                } else {
                    '_'
                }
            })
            .collect()
    }
    let origin_path = PathBuf::from(origin);
    let origin_file_name = PathBuf::from(origin_path.file_name().ok_or(io::Error::new(
        io::ErrorKind::Other,
        format!("Cannot get file name from {origin:?}"),
    ))?);
    let basename = sanitize(
        origin_file_name
            .file_stem()
            .ok_or(io::Error::new(
                io::ErrorKind::Other,
                "Fail to parse origin attachment path",
            ))?
            .to_string_lossy(),
    );
    let extension = origin_file_name.extension();
    let mut index: usize = 0;
    loop {
        let mut suggestion = if index == 0 {
            dest.join(PathBuf::from(&basename))
        } else {
            dest.join(PathBuf::from(format!("{basename}_{index}")))
        };
        if let Some(extension) = extension {
            suggestion = PathBuf::from(format!(
                "{}.{}",
                suggestion.to_string_lossy(),
                sanitize(extension.to_string_lossy())
            ));
        }
        if !suggestion.exists() {
            return Ok(suggestion);
        } else {
            index += 1;
        }
        if index > FILE_NAME_INDEXES_LIMIT {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                format!("Cannot find suitable file name for {origin}"),
            ));
        }
    }
}

#[derive(Debug)]
pub struct Attachments {
    attachments: HashMap<Uuid, stypes::AttachmentInfo>,
    dest: Option<PathBuf>,
}

impl Attachments {
    pub fn new() -> Self {
        Attachments {
            attachments: HashMap::new(),
            dest: None,
        }
    }

    pub fn get_attch_from(
        origin: definitions::Attachment,
        store_folder: &PathBuf,
    ) -> Result<stypes::AttachmentInfo, AttachmentsError> {
        if !store_folder.exists() {
            create_dir(store_folder).map_err(AttachmentsError::Io)?;
        }
        let uuid = Uuid::new_v4();
        let attachment_path =
            get_valid_file_path(store_folder, &origin.name).map_err(AttachmentsError::Io)?;
        let mut attachment_file = File::create(&attachment_path)?;
        attachment_file.write_all(&origin.data)?;
        Ok(stypes::AttachmentInfo {
            uuid,
            filepath: attachment_path,
            name: origin.name.clone(),
            ext: Path::new(&origin.name)
                .extension()
                .map(|ex| ex.to_string_lossy().to_string()),
            size: origin.size,
            mime: mime_guess::from_path(origin.name)
                .first()
                .map(|guess| guess.to_string()),
            messages: origin.messages,
        })
    }

    pub fn set_dest_path(&mut self, dest: PathBuf) -> bool {
        if let (Some(parent), Some(file_stem)) = (dest.parent(), dest.file_stem()) {
            let dest = parent.join(file_stem);
            self.dest = Some(dest);
            true
        } else {
            false
        }
    }

    pub fn len(&self) -> usize {
        self.attachments.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn add(
        &mut self,
        attachment: definitions::Attachment,
    ) -> Result<stypes::AttachmentInfo, AttachmentsError> {
        if let Some(dest) = self.dest.as_ref() {
            let uuid = Uuid::new_v4();
            let a = Self::get_attch_from(attachment, dest)?;
            self.attachments.insert(uuid, a.clone());
            Ok(a)
        } else {
            Err(AttachmentsError::SessionNotCreated)
        }
    }

    pub fn get(&self) -> Vec<stypes::AttachmentInfo> {
        self.attachments
            .values()
            .cloned()
            .collect::<Vec<stypes::AttachmentInfo>>()
    }
}

impl Default for Attachments {
    fn default() -> Self {
        Self::new()
    }
}
