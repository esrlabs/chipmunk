use mime_guess;
use parsers;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::Path};
use uuid::Uuid;
use log::warn;
use mime::Mime;
use mime_guess;
use parsers::{Attachment, AttachmentData};
use std::{collections::HashMap, fs::File, io::Write, path::Path};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub uuid: Uuid,
    pub filename: String,
    pub name: String,
    pub ext: Option<String>,
    pub size: usize,
    pub mime: Option<String>,
    pub messages: Vec<usize>,
}

impl Attachment {
    pub fn from(origin: parsers::Attachment) -> Attachment {
        Attachment {
            uuid: Uuid::new_v4(),
            filename: String::new(),
            name: origin.name.clone(),
            ext: Path::new(&origin.name)
                .extension()
                .map(|ex| ex.to_string_lossy().to_string()),
            size: origin.size,
            mime: mime_guess::from_path(origin.name)
                .first()
                .map(|guess| guess.to_string()),
            messages: origin.messages,
        }
    }
}


#[derive(Error, Debug)]
pub enum AttachmentsError {
    #[error("Save error: {0}")]
    Save(String),
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug)]
pub struct Attachments {
    attachments: HashMap<Uuid, Attachment>,
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
        attachment: Attachment,
        store_folder: &Path,
    ) -> Result<Attachment, AttachmentsError> {
        let uuid = Uuid::new_v4();
        let mut a = Attachments::check_mime(attachment);
        if let AttachmentData::Data(ref d) = a.data {
            let attachment_path = store_folder.join(uuid.to_string()).join(&a.name);
            if !attachment_path.exists() {
                let mut attachment_file = File::create(&attachment_path)?;
                attachment_file.write_all(d)?;
                a.data = AttachmentData::File(attachment_path);
            } else {
                warn!("Could not store attachment {}, path already exists", a.name);
            }
        }
        self.attachments.insert(uuid, a.clone());
        Ok(a)
    }

    pub fn get(&self) -> Vec<Attachment> {
        self.attachments
            .values()
            .cloned()
            .collect::<Vec<Attachment>>()
    }
}

impl Default for Attachments {
    fn default() -> Self {
        Self::new()
    }
}
