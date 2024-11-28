use crate::*;

impl std::fmt::Display for CallbackEvent {
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
