use stypes::{FilterMatch, GrabbedElement, NearestPosition};

use crate::session::{error::SessionError, ui::chart::ChartBar};

/// Messages sent to Session UI form services.
#[derive(Debug)]
pub enum SessionMessage {
    /// Update to the total count of logs (stream/file).
    LogsCount(u64),

    /// Result from fetching a specific log line.
    SelectedLog(Result<GrabbedElement, SessionError>),

    // --- Search ---
    //
    /// Metadata about the current search (e.g., total found).
    SearchState { found_count: u64 },

    /// Search matches found.
    SearchResults(Vec<FilterMatch>),

    /// The nearest log index to jump to in search table.
    NearestPosition(Result<Option<NearestPosition>, SessionError>),

    // --- Charts ---
    //
    /// Bar data for histograms.
    ChartHistogram(Result<Vec<Vec<ChartBar>>, SessionError>),

    /// Point data for line charts.
    ChartLinePlots(Result<Vec<(u8, Vec<stypes::Point>)>, SessionError>),
}
