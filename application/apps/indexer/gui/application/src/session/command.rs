use std::ops::RangeInclusive;

use processor::{grabber::LineRange, search::filter::SearchFilter};

/// Represents session specific commands to be sent from UI to State.
#[derive(Debug, Clone)]
pub enum SessionCommand {
    GrabLines(LineRange),
    GrabIndexedLines(RangeInclusive<u64>),
    ApplySearchFilter(Vec<SearchFilter>),
    DropSearch,
    CloseSession,
}
