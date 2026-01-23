use std::ops::RangeInclusive;

use std::sync::mpsc::Sender;

use processor::{grabber::LineRange, search::filter::SearchFilter};
use stypes::GrabbedElement;

use crate::session::error::SessionError;

/// Represents session specific commands to be sent from UI to session service.
///
/// # Note
///
/// These commands will be used in asynchronous context where UI wouldn't block
/// while they are running.
#[derive(Debug)]
pub enum SessionCommand {
    /// Apply the provided search filters.
    ApplySearchFilter(Vec<SearchFilter>),
    /// Cancel current search and clear results.
    DropSearch,
    /// Request the nearest index in the search view for a given main-log index.
    GetNearestPosition(u64),

    /// Request details for a specific log line.
    GetSelectedLog(u64),

    // --- Blocking Commands ---
    /// Synchronously fetches log lines for main table within the provided range.
    ///
    /// # Blocking
    ///
    /// Blocks UI rendering until the response is sent via `sender`.
    GrabLinesBlocking {
        range: LineRange,
        sender: Sender<Result<Vec<GrabbedElement>, SessionError>>,
    },
    /// Synchronously fetches specific lines by global index for search table.
    ///
    /// # Blocking
    ///
    /// Blocks UI rendering until the response is sent via `sender`.
    GrabIndexedLinesBlocking {
        range: RangeInclusive<u64>,
        sender: Sender<Result<Vec<GrabbedElement>, SessionError>>,
    },

    // --- Charts ---
    /// Request bar data for histograms.
    GetChartHistogram {
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
    },
    /// Request point data for line plots.
    GetChartLinePlots {
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
    },

    /// Gracefully terminate the session service.
    CloseSession,
}
