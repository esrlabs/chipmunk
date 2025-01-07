use crate::*;

/// Converts a `Vec<AttachmentInfo>` into an `AttachmentList`.
///
/// This implementation allows you to create an `AttachmentList` directly from a vector of
/// `AttachmentInfo` objects. It simplifies the conversion and ensures compatibility
/// between these types.
impl From<Vec<AttachmentInfo>> for AttachmentList {
    fn from(value: Vec<AttachmentInfo>) -> Self {
        Self(value)
    }
}
