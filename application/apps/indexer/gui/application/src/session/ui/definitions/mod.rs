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
