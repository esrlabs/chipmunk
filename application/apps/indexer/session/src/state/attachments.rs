use mime_guess;
use parsers::{self};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs::File,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentInfo {
    pub uuid: Uuid,
    pub file_path: PathBuf,
    pub name: String,
    pub ext: Option<String>,
    pub size: usize,
    pub mime: Option<String>,
    pub messages: Vec<usize>,
}

impl AttachmentInfo {
    pub fn from(
        origin: parsers::Attachment,
        store_folder: &Path,
    ) -> Result<AttachmentInfo, AttachmentsError> {
        let uuid = Uuid::new_v4();
        let attachment_path = store_folder.join(uuid.to_string()).join(&origin.name);
        let mut attachment_file = File::create(&attachment_path)?;
        attachment_file.write_all(&origin.data)?;
        Ok(AttachmentInfo {
            uuid,
            file_path: attachment_path,
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
}

impl Attachments {
    pub fn new() -> Self {
        Attachments {
            attachments: HashMap::new(),
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
        store_folder: &Path,
    ) -> Result<AttachmentInfo, AttachmentsError> {
        let uuid = Uuid::new_v4();
        let a = AttachmentInfo::from(attachment, store_folder)?;
        self.attachments.insert(uuid, a.clone());
        Ok(a)
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
