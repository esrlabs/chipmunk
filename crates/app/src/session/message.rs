use std::collections::HashMap;

use session_core::state::NestedMatch;
use stypes::{AttachmentInfo, FilterMatch, GrabbedElement};
use uuid::Uuid;

use crate::session::{
    error::SessionError,
    types::attachment,
    types::{ObserveOperation, OperationPhase},
    ui::chart::ChartBar,
};

/// Messages sent to Session UI form services.
#[derive(Debug)]
pub enum SessionMessage {
    /// Update to the total count of logs (stream/file).
    LogsCount(u64),

    /// Result from fetching a specific log line.
    SelectedLog(Result<GrabbedElement, SessionError>),

    // --- Search ---
    //
    /// Total number of rows matched by the active search.
    SearchResultCountUpdated { count: u64 },

    /// Total number of rows currently exposed by the indexed lower table.
    /// This can include search results, bookmarked rows, and any other indexed-map entries
    /// currently materialized by the backend.
    IndexedCountUpdated { count: u64 },

    /// Search matches found.
    SearchResults(Vec<FilterMatch>),

    /// Clear search matches after dropping or replacing the search map.
    SearchResultsCleared,

    /// Indexed-table row nearest to the requested session position.
    NearestIndexedRow {
        /// Resolved indexed-row index, or `None` when the indexed table is empty.
        result: Result<Option<u64>, SessionError>,
    },

    /// Result of one correlated Find in Search Results request.
    NestedMatchResult {
        /// Identifies the request that produced this response.
        request_id: Uuid,
        /// Matching coordinates, no-match outcome, or backend failure.
        result: Result<Option<NestedMatch>, SessionError>,
    },

    /// Adjacent indexed main-log row resolved by the backend.
    IndexedNeighbor(u64),

    /// Confirmed bookmark mutations from the session backend.
    BookmarkUpdated(Vec<BookmarkUpdate>),

    // --- Charts ---
    //
    /// Bar data for histograms.
    ChartHistogram(Result<Vec<Vec<ChartBar>>, SessionError>),

    /// Point data for line charts.
    ChartLinePlots(Result<Vec<(u8, Vec<stypes::Point>)>, SessionError>),

    /// Push-based search values metadata used by charts.
    ChartSearchValues(Option<HashMap<u8, (f64, f64)>>),

    /// Updated the phase of an operation
    OperationUpdated {
        operation_id: Uuid,
        phase: OperationPhase,
    },

    /// Source has been added to session.
    SourceAdded { observe_op: Box<ObserveOperation> },

    /// Triggered when a file is opened within the session.
    /// Although `chipmunk` continues to monitor the file for changes,
    /// this event is triggered upon the completion of file reading.
    /// This event is not triggered for streams within a session.
    FileReadCompleted,

    /// Triggered when attachments are updated
    AttachmentsUpdated {
        attachment: Box<AttachmentInfo>,
        len: u64,
    },

    /// Preview result for one attachment.
    AttachmentPreview {
        attachment_id: Uuid,
        target: attachment::PreviewTarget,
        preview: Result<attachment::PreviewContent, SessionError>,
    },

    /// Result of sending text into a source through SDE.
    SdeSendFinished(Result<(), SessionError>),
}

/// Bookmark mutation confirmed by the session backend.
#[derive(Debug)]
pub struct BookmarkUpdate {
    pub row: u64,
    pub is_bookmarked: bool,
}
