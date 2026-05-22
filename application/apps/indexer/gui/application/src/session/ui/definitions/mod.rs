use std::ops::Range;

use memchr::memchr;

use stypes::GrabbedElement;

use crate::session::ui::common::ansi_text::{AnsiText, parse_ansi_text};

pub mod schema;

/// Represent a log item to be represented in logs tables.
#[derive(Debug, Clone)]
pub struct LogTableItem {
    pub element: GrabbedElement,
    pub cells: Vec<LogTableCell>,
}

/// Prepared text for one log-table column.
#[derive(Debug, Clone)]
pub enum LogTableCell {
    /// Plain cell text borrowed from the prepared log content.
    Plain(Range<usize>),
    /// ANSI-styled cell text with escapes stripped from the visible content.
    Ansi(AnsiText),
}

impl LogTableCell {
    /// Builds a display cell from a byte range in prepared log content.
    pub fn from_range(content: &str, range: Range<usize>) -> Self {
        let cell_text = content.get(range.clone()).unwrap_or_default();
        if memchr(0x1b, cell_text.as_bytes()).is_some() {
            Self::Ansi(parse_ansi_text(cell_text))
        } else {
            Self::Plain(range)
        }
    }
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
