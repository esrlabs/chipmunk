//! Shared text rendering for searchable picker overlays.

use std::ops::Range;

/// Text plus byte ranges to highlight while rendering a picker row.
#[derive(Debug, Clone)]
pub struct SearchPickerText {
    /// Text to render in the picker row.
    pub text: String,
    /// Byte ranges to highlight inside `text`.
    pub highlights: Vec<Range<usize>>,
}

impl SearchPickerText {
    /// Creates picker text with caller-provided highlight byte ranges.
    pub fn new(text: impl Into<String>, highlights: Vec<Range<usize>>) -> Self {
        Self {
            text: text.into(),
            highlights,
        }
    }
}
