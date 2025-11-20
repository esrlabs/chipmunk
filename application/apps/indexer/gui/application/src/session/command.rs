use std::ops::RangeInclusive;

use tokio::sync::oneshot::Sender;

use processor::{grabber::LineRange, search::filter::SearchFilter};
use stypes::GrabbedElement;

/// Represents session specific commands to be sent from UI to session service.
///
/// # Note
///
/// These commands will be used in asynchronous context where UI wouldn't block
/// while they are running.
#[derive(Debug, Clone)]
pub enum SessionCommand {
    /// Apply the provided search filters.
    ApplySearchFilter(Vec<SearchFilter>),
    /// Cancel current search and clear results.
    DropSearch,
    /// Request the nearest index in the search view for a given main-log index.
    GetNearestPosition(u64),

    /// Request details for a specific log line.
    GetSelectedLog(u64),

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

/// Commands sent from UI to service in blocking context will rendering
/// UI frames will be blocked until the command finishes.
pub enum SessionBlockingCommand {
    /// Grab lines to be used in main table within provided range and send
    /// them back via sender.
    GrabLines {
        range: LineRange,
        sender: Sender<Vec<GrabbedElement>>,
    },
    /// Grab indexed lines to be used is search table within provided range
    /// and send them back via sender.
    GrabIndexedLines {
        range: RangeInclusive<u64>,
        sender: Sender<Vec<GrabbedElement>>,
    },
}
