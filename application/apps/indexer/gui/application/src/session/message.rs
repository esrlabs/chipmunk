use std::collections::HashMap;

use stypes::{FilterMatch, GrabbedElement, NearestPosition};
use uuid::Uuid;

use crate::session::{
    error::SessionError,
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

    /// The nearest log index to jump to in search table.
    NearestPosition(Result<Option<NearestPosition>, SessionError>),

    /// Confirmed bookmark mutation from the session backend.
    BookmarkUpdated { row: u64, is_bookmarked: bool },

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
}
