use std::{fmt::Debug, ops::Range};

pub mod dlt;
pub mod plugins;
pub mod someip;
pub mod text;

pub type CowStr = std::borrow::Cow<'static, str>;

/// Defines the visual structure and parsing logic for a specific log format.
///
/// Implementing this trait allows the UI to render different log types (Text, DLT, Plugins)
/// indiscriminately by abstracting away the column layout and row segmentation.
pub trait LogSchema: Debug {
    /// Determines if the log table should display a specific header row.
    fn has_headers(&self) -> bool;

    /// Returns the definitions for the table columns.
    fn columns(&self) -> &[ColumnInfo];

    /// Segments a single log line into column ranges.
    fn map_columns(&self, log: &str) -> Vec<Range<usize>>;
}

#[derive(Debug, Clone)]
pub struct ColumnInfo {
    pub header: CowStr,
    pub header_tooltip: CowStr,
    pub column: egui_table::Column,
}

impl ColumnInfo {
    pub fn new(
        header: impl Into<CowStr>,
        header_tooltip: impl Into<CowStr>,
        column: egui_table::Column,
    ) -> Self {
        Self {
            header: header.into(),
            column,
            header_tooltip: header_tooltip.into(),
        }
    }
}

/// Helper function to map columns based on a specific character separator.
pub fn map_columns_with_separator(log: &str, ranges: &mut Vec<Range<usize>>, separtor: char) {
    let mut start_index = 0;

    for (idx, text) in log.match_indices(separtor) {
        ranges.push(start_index..idx);

        // Advance start past the separator
        start_index = idx + text.len();
    }

    // Push the final column (everything after the last separator)
    ranges.push(start_index..log.len());
}

#[cfg(test)]
mod tests {
    use super::*;

    fn get_slices<'a>(text: &'a str, ranges: &[std::ops::Range<usize>]) -> Vec<&'a str> {
        ranges.iter().map(|r| &text[r.clone()]).collect()
    }

    #[test]
    fn test_consecutive_separators_empty_columns() {
        let log = "VAL1||VAL2|||VAL3";
        let sep = '|';
        let mut ranges = Vec::new();

        map_columns_with_separator(log, &mut ranges, sep);

        let slices = get_slices(log, &ranges);

        // We expect empty strings between the consecutive pipes
        assert_eq!(slices, vec!["VAL1", "", "VAL2", "", "", "VAL3"]);

        // Verify specific range indices for the empty column between VAL1 and VAL2
        // VAL1 is 0..4, first pipe at 4.
        // First range: 0..4
        // Second range (empty): 5..5
        assert_eq!(ranges[1], 5..5);
    }

    #[test]
    fn test_leading_and_trailing_separators() {
        let log = "|VAL1|VAL2|";
        let sep = '|';
        let mut ranges = Vec::new();

        map_columns_with_separator(log, &mut ranges, sep);
        let slices = get_slices(log, &ranges);

        // Should result in empty start and empty end
        assert_eq!(slices, vec!["", "VAL1", "VAL2", ""]);
    }

    #[test]
    fn test_only_separators() {
        let log = "||";
        let sep = '|';
        let mut ranges = Vec::new();

        map_columns_with_separator(log, &mut ranges, sep);
        let slices = get_slices(log, &ranges);

        // || should produce 3 columns: (empty)|(empty)|(empty)
        assert_eq!(slices, vec!["", "", ""]);
    }

    #[test]
    fn test_empty_string() {
        let log = "";
        let sep = '|';
        let mut ranges = Vec::new();

        map_columns_with_separator(log, &mut ranges, sep);
        let slices = get_slices(log, &ranges);

        // An empty string usually implies one empty column
        assert_eq!(slices, vec![""]);
        assert_eq!(ranges[0], 0..0);
    }

    #[test]
    fn test_no_separator_present() {
        let log = "WHOLE_LINE";
        let sep = '|';
        let mut ranges = Vec::new();

        map_columns_with_separator(log, &mut ranges, sep);
        let slices = get_slices(log, &ranges);

        assert_eq!(slices, vec!["WHOLE_LINE"]);
        assert_eq!(ranges[0], 0..10);
    }

    #[test]
    fn test_multibyte_separator() {
        // Using a 4-byte character as separator: 🚀
        let log = "A🚀B";
        let sep = '🚀';
        let mut ranges = Vec::new();

        map_columns_with_separator(log, &mut ranges, sep);
        let slices = get_slices(log, &ranges);

        assert_eq!(slices, vec!["A", "B"]);

        // Check indices to ensure we skipped the 4 bytes of the character correctly
        // "A" is byte 0.
        // "🚀" is bytes 1,2,3,4.
        // "B" starts at byte 5.
        assert_eq!(ranges[0], 0..1); // "A"
        assert_eq!(ranges[1], 5..6); // "B"
    }
}
