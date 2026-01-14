use std::ops::Range;

use stypes::GrabbedElement;

pub mod schema;

/// Represent a log item to be represented in logs tables including
/// the grabbed element and its columns' ranges.
#[derive(Debug, Clone)]
pub struct LogTableItem {
    pub element: GrabbedElement,
    pub column_ranges: Vec<Range<usize>>,
}

/// Represents the outcome of updating the operation by a state component.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UpdateOperationOutcome {
    /// Operation update has been consumed by state component.
    Consumed,
    /// Operation isn't part of state component.
    None,
}

impl UpdateOperationOutcome {
    pub fn consumed(self) -> bool {
        self == Self::Consumed
    }
}
