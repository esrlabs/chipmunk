use crate::*;

impl std::fmt::Display for CallbackEvent {
    /// Implements the `Display` trait for `CallbackEvent`.
    ///
    /// This provides a human-readable string representation for each variant of the
    /// `CallbackEvent` enum, making it easier to log or debug events.
    ///
    /// # Format
    /// - `StreamUpdated(len)` - Displays the length of the updated stream.
    /// - `FileRead` - Indicates that a file has been read.
    /// - `SearchUpdated(found)` - Shows the number of search results found.
    /// - `IndexedMapUpdated(len)` - Displays the number of indexed map entries.
    /// - `SearchMapUpdated` - Indicates that the search map has been updated.
    /// - `SearchValuesUpdated` - Indicates that search values have been updated.
    /// - `AttachmentsUpdated: {len}` - Displays the size of the updated attachment.
    /// - `Progress` - Indicates progress for an operation.
    /// - `SessionError: {err:?}` - Displays details of a session error.
    /// - `OperationError: {uuid}: {error:?}` - Displays the UUID of the operation and the error details.
    /// - `OperationStarted: {uuid}` - Displays the UUID of a started operation.
    /// - `OperationProcessing: {uuid}` - Displays the UUID of an operation in progress.
    /// - `OperationDone: {info.uuid}` - Displays the UUID of a completed operation.
    /// - `SessionDestroyed` - Indicates that the session has been destroyed.
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            Self::StreamUpdated(len) => write!(f, "StreamUpdated({len})"),
            Self::FileRead => write!(f, "FileRead"),
            Self::SearchUpdated { found, stat: _ } => write!(f, "SearchUpdated({found})"),
            Self::IndexedMapUpdated { len } => write!(f, "IndexedMapUpdated({len})"),
            Self::SearchMapUpdated(_) => write!(f, "SearchMapUpdated"),
            Self::SearchValuesUpdated(_) => write!(f, "SearchValuesUpdated"),
            Self::AttachmentsUpdated { len, attachment: _ } => {
                write!(f, "AttachmentsUpdated: {}", len)
            }
            Self::Progress {
                uuid: _,
                progress: _,
            } => write!(f, "Progress"),
            Self::SessionError(err) => write!(f, "SessionError: {err:?}"),
            Self::SessionDescriptor { uuid, desc } => {
                write!(
                    f,
                    "SessionDescriptor for {uuid}: {:?}/{:?}",
                    desc.s_desc, desc.p_desc
                )
            }
            Self::OperationError { uuid, error } => {
                write!(f, "OperationError: {uuid}: {error:?}")
            }
            Self::OperationStarted(uuid) => write!(f, "OperationStarted: {uuid}"),
            Self::OperationProcessing(uuid) => write!(f, "OperationProcessing: {uuid}"),
            Self::OperationDone(info) => write!(f, "OperationDone: {}", info.uuid),
            Self::SessionDestroyed => write!(f, "SessionDestroyed"),
        }
    }
}
