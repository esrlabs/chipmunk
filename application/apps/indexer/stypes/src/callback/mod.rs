#[cfg(any(test, feature = "rustcore"))]
mod extending;
#[cfg(any(test, feature = "rustcore"))]
mod formating;

use crate::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub struct OperationDone {
    pub uuid: Uuid,
    pub result: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
pub enum CallbackEvent {
    /**
     * Triggered on update of stream (session) file
     * @event StreamUpdated { rows: usize }
     * rows - count of rows, which can be requested with method [grab]
     * >> Scope: session
     * >> Kind: repeated
     */
    StreamUpdated(u64),
    /**
     * Triggered on file has been read complitely. After this event session starts tail
     * @event FileRead
     * >> Scope: session
     * >> Kind: once
     */
    FileRead,
    /**
     * Triggered on update of search result data
     * @event SearchUpdated { rows: usize }
     * rows - count of rows, which can be requested with method [grabSearchResult]
     * >> Scope: session
     * >> Kind: repeated
     */
    SearchUpdated {
        found: u64,
        stat: HashMap<String, u64>,
    },
    /**
     * Triggered on update of indexed map
     * @event IndexedMapUpdated { len: u64 }
     * len - count of rows, which can be requested with method [grabSearchResult]
     * >> Scope: session
     * >> Kind: repeated
     */
    IndexedMapUpdated { len: u64 },
    /**
     * Triggered on update of search result data
     * @event SearchMapUpdated { Option<String> }
     * includes JSON String of Vec<u64> - map of all matches in search
     * also called with each search update if there are streaming
     * None - map is dropped
     * >> Scope: session
     * >> Kind: repeated
     */
    SearchMapUpdated(Option<String>),
    /**
     * Triggered on update of search values data. Used for charts
     * @event SearchValuesUpdated
     * in search with values also called with each search update if there are streaming
     * true - map is dropped
     * >> Scope: session
     * >> Kind: repeated
     */
    SearchValuesUpdated(Option<HashMap<u8, (f64, f64)>>),
    /**
     * Triggered with new attachment has been detected
     * len - number of already detected attachments (in session)
     * uuid - UUID of new attachment
     * >> Scope: async operation
     * >> Kind: repeated
     */
    AttachmentsUpdated {
        len: u64,
        attachment: AttachmentInfo,
    },
    /**
     * Triggered on progress of async operation
     * @event Progress: { total: usize, done: usize }
     * >> Scope: async operation
     * >> Kind: repeated
     */
    Progress { uuid: Uuid, progress: Progress },
    /**
     * Triggered on error in the scope of session
     * >> Scope: session
     * >> Kind: repeated
     */
    SessionError(NativeError),
    /**
     * Triggered on error in the scope proccessing an async operation
     * >> Scope: session, async operation
     * >> Kind: repeated
     */
    OperationError { uuid: Uuid, error: NativeError },
    /**
     * Operations is created; task is spawned.
     * This even is triggered always
     * Triggered on all continues asynch operation like observe
     * >> Scope: async operation
     * >> Kind: repeated
     */
    OperationStarted(Uuid),
    /**
     * All initializations are done and operation is processing now.
     * There are no guarantees an event would be triggered. It depends
     * on each specific operation. This event can be triggered multiple
     * times in the scope of one operation (for example concat).
     * Could be triggered on continues asynch operation like observe
     * >> Scope: async operation
     * >> Kind: repeated
     */
    OperationProcessing(Uuid),
    /**
     * Triggered on some asynch operation is done
     * >> Scope: async operation
     * >> Kind: repeated
     */
    OperationDone(OperationDone),
    /**
     * Triggered on session is destroyed
     * >> Scope: session
     * >> Kind: once
     */
    SessionDestroyed,
}
