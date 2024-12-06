#[cfg(feature = "rustcore")]
mod converting;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

/// Describes the content of attached data found in the `payload` of a `dlt` message.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct AttachmentInfo {
    /// A unique identifier for the attachment.
    pub uuid: Uuid,
    /// The full path to the file. Note that `chipmunk` serializes the file name to ensure proper
    /// saving to disk, so the actual file name may differ from the value in the `name` field.
    pub filepath: PathBuf,
    /// The name of the application, usually corresponding to the file name.
    pub name: String,
    /// The file extension, if available.
    pub ext: Option<String>,
    /// The size of the file in bytes.
    pub size: usize,
    /// The `mime` type of the file, if it could be determined.
    pub mime: Option<String>,
    /// The log entry numbers containing the application data. Note that the application
    /// data may be contained in a single log entry or split into parts distributed
    /// across sequential log entries.
    pub messages: Vec<usize>,
}

/// A list of attachments.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct AttachmentList(pub Vec<AttachmentInfo>);
