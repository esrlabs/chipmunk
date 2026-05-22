//! Shared text matchers for UI-side filtering and picker search.

use std::ops::Range;

use unicode_segmentation::UnicodeSegmentation;

pub mod fuzzy_matcher;
pub mod substring_matcher;

/// Converts nucleo match indices into merged byte ranges for safe string slicing.
fn nucleo_highlight_ranges(text: &str, indices: &mut Vec<u32>) -> Vec<Range<usize>> {
    if indices.is_empty() {
        return Vec::new();
    }

    indices.sort_unstable();
    indices.dedup();

    // Mirrors `Utf32Str::new`, which keeps raw bytes when grapheme heads are ASCII.
    let uses_byte_indices = text.is_ascii()
        || text
            .graphemes(true)
            .all(|grapheme| grapheme.chars().next().is_some_and(|ch| ch.is_ascii()));

    let ranges = if uses_byte_indices {
        byte_index_ranges(text, indices)
    } else {
        grapheme_index_ranges(text, indices)
    };

    merge_ranges(ranges)
}

/// Converts nucleo indices that already point into the original string bytes.
fn byte_index_ranges(text: &str, indices: &[u32]) -> Vec<Range<usize>> {
    let mut ranges = Vec::with_capacity(indices.len());

    for &index in indices {
        let start = index as usize;
        if start >= text.len() {
            continue;
        }

        if text.is_ascii() {
            ranges.push(start..start + 1);
        } else if let Some(range) = grapheme_range_containing(text, start) {
            ranges.push(range);
        }
    }

    ranges
}

/// Converts nucleo indices that refer to grapheme positions in the string.
fn grapheme_index_ranges(text: &str, indices: &[u32]) -> Vec<Range<usize>> {
    let mut ranges = Vec::with_capacity(indices.len());
    let mut next_index = 0;

    for (grapheme_index, (start, grapheme)) in text.grapheme_indices(true).enumerate() {
        while next_index < indices.len() && (indices[next_index] as usize) < grapheme_index {
            next_index += 1;
        }
        if next_index >= indices.len() {
            break;
        }
        if (indices[next_index] as usize) == grapheme_index {
            ranges.push(start..start + grapheme.len());
            next_index += 1;
        }
    }

    ranges
}

/// Returns the full grapheme range that contains `byte_index`.
fn grapheme_range_containing(text: &str, byte_index: usize) -> Option<Range<usize>> {
    text.grapheme_indices(true).find_map(|(start, grapheme)| {
        let end = start + grapheme.len();
        (start <= byte_index && byte_index < end).then_some(start..end)
    })
}

/// Merges touching or overlapping ranges for compact rendering spans.
fn merge_ranges(ranges: Vec<Range<usize>>) -> Vec<Range<usize>> {
    let mut merged: Vec<Range<usize>> = Vec::with_capacity(ranges.len());

    for range in ranges {
        if let Some(last) = merged.last_mut()
            && range.start <= last.end
        {
            last.end = last.end.max(range.end);
        } else {
            merged.push(range);
        }
    }

    merged
}
