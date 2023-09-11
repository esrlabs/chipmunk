use mime_guess;
use parsers::{self};
use serde::{Deserialize, Serialize};
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentInfo {
    pub uuid: Uuid,
    // This entity will be propagated into JS world side, to avoid unusual naming file_path,
    // would be used filepath instead
    pub filepath: PathBuf,
    pub name: String,
    pub ext: Option<String>,
    pub size: usize,
    pub mime: Option<String>,
    pub messages: Vec<usize>,
}

const FILE_NAME_INDEXES_LIMIT: usize = 1000;

fn get_valid_file_path(dest: &Path, origin: &str) -> Result<PathBuf, io::Error> {
    let origin_path = PathBuf::from(origin);
    let origin_file_name = PathBuf::from(origin_path.file_name().ok_or(io::Error::new(
        io::ErrorKind::Other,
        format!("Cannot get file name from {origin:?}"),
    ))?);
    if let Some(basename) = origin_file_name.file_stem() {
        let extension = origin_file_name.extension();
        let mut index: usize = 0;
        loop {
            let mut suggestion = if index == 0 {
                dest.join(PathBuf::from(basename))
            } else {
                dest.join(PathBuf::from(format!(
                    "{}_{index}",
                    basename.to_string_lossy()
                )))
            };
            if let Some(extension) = extension {
                suggestion = PathBuf::from(format!(
                    "{}.{}",
                    suggestion.to_string_lossy(),
                    extension.to_string_lossy()
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
    } else {
        Err(io::Error::new(
            io::ErrorKind::Other,
            "Fail to parse origin attachment path",
        ))
    }
}

impl AttachmentInfo {
    pub fn from(
        origin: parsers::Attachment,
        store_folder: &PathBuf,
    ) -> Result<AttachmentInfo, AttachmentsError> {
        if !store_folder.exists() {
            create_dir(store_folder).map_err(AttachmentsError::Io)?;
        }
        let uuid = Uuid::new_v4();
        let attachment_path =
            get_valid_file_path(store_folder, &origin.name).map_err(AttachmentsError::Io)?;
        let mut attachment_file = File::create(&attachment_path)?;
        attachment_file.write_all(&origin.data)?;
        Ok(AttachmentInfo {
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
}

#[derive(Debug)]
pub struct Attachments {
    attachments: HashMap<Uuid, AttachmentInfo>,
    dest: Option<PathBuf>,
}

impl Attachments {
    pub fn new() -> Self {
        Attachments {
            attachments: HashMap::new(),
            dest: None,
        }
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
        attachment: parsers::Attachment,
    ) -> Result<AttachmentInfo, AttachmentsError> {
        if let Some(dest) = self.dest.as_ref() {
            let uuid = Uuid::new_v4();
            let a = AttachmentInfo::from(attachment, dest)?;
            self.attachments.insert(uuid, a.clone());
            Ok(a)
        } else {
            Err(AttachmentsError::SessionNotCreated)
        }
    }

    pub fn get(&self) -> Vec<AttachmentInfo> {
        self.attachments
            .values()
            .cloned()
            .collect::<Vec<AttachmentInfo>>()
    }
}

impl Default for Attachments {
    fn default() -> Self {
        Self::new()
    }
}
