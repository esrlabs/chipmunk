use std::ops::RangeInclusive;

use tokio::sync::oneshot::Sender;

use processor::{grabber::LineRange, search::filter::SearchFilter};
use stypes::GrabbedElement;

/// Represents session specific commands to be sent from UI to State.
///
/// # Note
///
/// These commands will be used in asynchronous context where they have access
/// to modify session data state.
#[derive(Debug, Clone)]
pub enum SessionCommand {
    ApplySearchFilter(Vec<SearchFilter>),
    DropSearch,
    /// Gets the nearest position in filtered items to the provided log position
    /// from the main tables view.
    GetNearestPosition(u64),
    SetSelectedLog(Option<u64>),

    GetChartMap {
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
    },
    GetChartValues {
        dataset_len: u16,
        range: Option<RangeInclusive<u64>>,
    },
    CloseSession,
}

/// Commands which will be used in blocking context without having access
/// to the session data state. Instead the results should be sent directly
/// to the UI.
///
/// # Note
///
/// These commands will be sent while holding reference to session data state
/// therefore, the receivers should never have access to this state to avoid
/// dead-locks
pub enum SessionBlockingCommand {
    /// Grab lines in the provided range and send them back via sender.
    GrabLines {
        range: LineRange,
        sender: Sender<Vec<GrabbedElement>>,
    },
    /// Grab indexed lines in the provided range and send them back via sender.
    GrabIndexedLines {
        range: RangeInclusive<u64>,
        sender: Sender<Vec<GrabbedElement>>,
    },
}
