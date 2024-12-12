#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

/// Represents a notification about an event (including potential errors)
/// related to processing a specific log entry, if such data is available.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "progress.ts"))]
pub struct Notification {
    /// The severity level of the event.
    pub severity: Severity,
    /// The content or message describing the event.
    pub content: String,
    /// The log entry number that triggered the event, if applicable.
    pub line: Option<usize>,
}

/// Describes the progress of an operation.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "progress.ts"))]
pub enum Progress {
    /// Represents the current progress status.
    Ticks(Ticks),
    /// A notification related to the progress of the operation.
    Notification(Notification),
    /// Indicates that the operation has been stopped.
    Stopped,
}

/// Provides detailed information about the progress of an operation.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "progress.ts"))]
pub struct Ticks {
    /// The current progress count, typically representing `n` out of `100%`.
    pub count: u64,
    /// The name of the current progress stage, for user display purposes.
    pub state: Option<String>,
    /// The total progress counter. Usually `100`, but for file operations,
    /// it might represent the file size, where `count` indicates the number of bytes read.
    pub total: Option<u64>,
}
