use crate::*;

impl From<Vec<AttachmentInfo>> for AttachmentList {
    fn from(value: Vec<AttachmentInfo>) -> Self {
        Self(value)
    }
}
