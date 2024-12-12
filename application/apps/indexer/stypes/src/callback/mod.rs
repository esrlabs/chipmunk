#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "rustcore")]
mod formating;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

/// Contains the results of an operation.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "callback.ts"))]
pub struct OperationDone {
    /// The unique identifier of the operation.
    pub uuid: Uuid,
    /// The results of the operation, if available.
    pub result: Option<String>,
}

/// Represents events sent to the client.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(test, derive(TS), ts(export, export_to = "callback.ts"))]
pub enum CallbackEvent {
    /// Triggered when the content of the current session is updated.
    /// - `u64`: The current number of log entries in the stream.
    /// This can be triggered with `0` when the session is created.
    StreamUpdated(u64),

    /// Triggered when a file is opened within the session.
    /// Although `chipmunk` continues to monitor the file for changes,
    /// this event is triggered upon the completion of file reading.
    /// This event is not triggered for streams within a session.
    FileRead,

    /// Triggered when search results are updated.
    SearchUpdated {
        /// The number of logs with matches. Can be `0` if the search is reset on the client side.
        found: u64,
        /// A map of search conditions and their global match counts within the session.
        /// - `String`: The search condition.
        /// - `u64`: The count of matches.
        #[cfg_attr(test, ts(type = "Map<string, number>"))]
        stat: HashMap<String, u64>,
    },

    /// Always triggered immediately after `SearchUpdated`. Contains data about
    /// the number of log entries from search results that are available for reading.
    IndexedMapUpdated {
        /// The number of log entries from search results available for reading.
        len: u64,
    },

    /// Always triggered immediately after `SearchUpdated`. Contains data about
    /// the search conditions that matched, along with the indices of log entries where matches were found.
    /// - `Option<FilterMatchList>`: The list of matches with log entry indices.
    SearchMapUpdated(Option<FilterMatchList>),

    /// Triggered when the "value map" is updated. The "value map" is used to build charts
    /// from search results. Always triggered immediately after `SearchUpdated`.
    /// - `Option<HashMap<u8, (f64, f64)>>`: The value map.
    #[cfg_attr(test, ts(type = "Map<number, [number, number]>"))]
    SearchValuesUpdated(Option<HashMap<u8, (f64, f64)>>),

    /// Triggered whenever a new attachment is detected in the logs.
    AttachmentsUpdated {
        /// The size of the attachment in bytes.
        len: u64,
        /// The description of the attachment.
        attachment: AttachmentInfo,
    },

    /// Triggered when progress is made during an operation.
    Progress {
        /// The unique identifier of the operation.
        uuid: Uuid,
        /// Information about the progress.
        progress: Progress,
    },

    /// Triggered in the event of an undefined session error.
    SessionError(NativeError),

    /// Triggered when an operation ends with an error.
    /// This event may follow `OperationStarted` since that event only indicates
    /// that the operation began successfully. It may also follow `OperationProcessing`.
    ///
    /// However, this event cannot precede or follow `OperationDone`, which is triggered
    /// upon successful operation completion.
    OperationError {
        /// The unique identifier of the operation that caused the error.
        uuid: Uuid,
        /// The error details.
        error: NativeError,
    },

    /// Triggered when an operation starts successfully. This event is only
    /// triggered once for each specific operation.
    /// - `Uuid`: The unique identifier of the operation.
    OperationStarted(Uuid),

    /// Triggered while an operation is in progress. This event can only follow
    /// `OperationStarted` and may be triggered multiple times for a single operation.
    /// - `Uuid`: The unique identifier of the operation.
    OperationProcessing(Uuid),

    /// Triggered upon the successful completion of an operation.
    /// - `OperationDone`: The results of the completed operation.
    OperationDone(OperationDone),

    /// Triggered when the current session is fully closed, and all necessary cleanup
    /// procedures are completed. This event guarantees that all possible read/write
    /// operations are stopped, and all previously created loops are terminated.
    SessionDestroyed,
}
