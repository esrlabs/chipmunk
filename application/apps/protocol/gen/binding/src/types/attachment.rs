use crate::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentInfo {
    pub uuid: String,
    pub filepath: PathBuf,
    pub name: String,
    pub ext: Option<String>,
    pub size: usize,
    pub mime: Option<String>,
    pub messages: Vec<usize>,
}

impl TryFrom<attachment::AttachmentInfo> for AttachmentInfo {
    type Error = E;
    fn try_from(att: attachment::AttachmentInfo) -> Result<Self, Self::Error> {
        Ok(AttachmentInfo {
            uuid: att.uuid,
            filepath: PathBuf::from(att.filepath),
            name: att.name,
            ext: if att.ext.is_empty() {
                None
            } else {
                Some(att.ext)
            },
            size: att.size as usize,
            mime: if att.mime.is_empty() {
                None
            } else {
                Some(att.mime)
            },
            messages: att.messages.into_iter().map(|v| v as usize).collect(),
        })
    }
}
