use mime::Mime;
use mime_guess;
use parsers::Attachment;
use std::collections::HashMap;
use uuid::Uuid;

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

    pub fn add(&mut self, attachment: Attachment) -> Uuid {
        let uuid = Uuid::new_v4();
        let a = Attachments::check_mime(attachment);
        self.attachments.insert(uuid, a);
        uuid
    }

    fn check_mime(mut attachment: Attachment) -> Attachment {
        if if let Some(mime_str) = attachment.mime.as_ref() {
            mime_str.parse::<Mime>().is_err()
        } else {
            true
        } {
            attachment.mime = mime_guess::from_path(&attachment.name)
                .first()
                .map(|guess| guess.to_string());
        }
        attachment
    }
}

impl Default for Attachments {
    fn default() -> Self {
        Self::new()
    }
}
