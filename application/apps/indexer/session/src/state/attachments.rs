use mime_guess;
use parsers;
use serde::Serialize;
use std::{collections::HashMap, path::Path};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
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

    pub fn add(&mut self, origin: parsers::Attachment) -> Uuid {
        let attachment = Attachment::from(origin);
        let uuid = attachment.uuid;
        self.attachments.insert(uuid, attachment);
        uuid
    }
}

impl Default for Attachments {
    fn default() -> Self {
        Self::new()
    }
}
