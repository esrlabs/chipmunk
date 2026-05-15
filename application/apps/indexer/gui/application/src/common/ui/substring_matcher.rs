//! Case-insensitive literal substring matching for small UI-side filters.
//!
//! This wraps `nucleo-matcher` behind a tiny API suited for egui state.
//! Queries are built explicitly on text changes and reused during row matching.

use std::ops::{Not, Range};

use nucleo_matcher::{
    Matcher, Utf32Str,
    pattern::{Atom, AtomKind, CaseMatching, Normalization},
};
use unicode_segmentation::UnicodeSegmentation;

/// Reusable case-insensitive literal substring matcher for UI text filtering.
#[derive(Debug, Clone, Default)]
pub struct SubstringMatcher {
    matcher: Matcher,
    query: Option<Atom>,
    text_buf: Vec<char>,
    /// Reused memory buffer for `Atom::indices`, which nucleo appends into.
    indices_buf: Vec<u32>,
}

impl SubstringMatcher {
    /// Rebuilds the compiled query for subsequent literal substring matches.
    ///
    /// Passing an empty string clears the current query and resets the matcher.
    ///
    /// # Note:
    /// Call this when the user-entered query changes, not on every frame.
    pub fn build_query(&mut self, query: &str) {
        self.query = query.is_empty().not().then(|| {
            Atom::new(
                query,
                CaseMatching::Ignore,
                Normalization::Never,
                AtomKind::Substring,
                false,
            )
        });
    }

    /// Returns whether a non-empty query is currently built.
    pub fn has_query(&self) -> bool {
        self.query.is_some()
    }

    /// Returns whether `text` matches the current query.
    ///
    /// An empty query matches all input text.
    pub fn matches(&mut self, text: &str) -> bool {
        let Some(query) = self.query.as_ref() else {
            return true;
        };

        query
            .score(Utf32Str::new(text, &mut self.text_buf), &mut self.matcher)
            .is_some()
    }

    /// Returns byte ranges for underlining the current query match inside `text`.
    ///
    /// Nucleo reports match positions as text indices, so this converts them to
    /// byte ranges that can safely slice the original string. Empty queries and
    /// non-matching text produce no highlight ranges.
    pub fn highlight_ranges(&mut self, text: &str) -> Vec<Range<usize>> {
        let Some(query) = self.query.as_ref() else {
            return Vec::new();
        };

        self.indices_buf.clear();
        let matched = query.indices(
            Utf32Str::new(text, &mut self.text_buf),
            &mut self.matcher,
            &mut self.indices_buf,
        );

        if matched.is_none() || self.indices_buf.is_empty() {
            return Vec::new();
        }

        self.indices_buf.sort_unstable();
        self.indices_buf.dedup();

        // Mirrors `Utf32Str::new`, which keeps raw bytes when grapheme heads are ASCII.
        let uses_byte_indices = text.is_ascii()
            || text
                .graphemes(true)
                .all(|grapheme| grapheme.chars().next().is_some_and(|ch| ch.is_ascii()));

        let ranges = if uses_byte_indices {
            byte_index_ranges(text, &self.indices_buf)
        } else {
            grapheme_index_ranges(text, &self.indices_buf)
        };

        merge_ranges(ranges)
    }
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

#[cfg(test)]
mod tests {
    use super::SubstringMatcher;

    #[test]
    fn empty_query_matches_all_text() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("");

        assert!(!matcher.has_query());
        assert!(matcher.matches("alpha"));
        assert!(matcher.matches(""));
    }

    #[test]
    fn matches_literal_substring_ignoring_case() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("Err");

        assert!(matcher.has_query());
        assert!(matcher.matches("status error"));
        assert!(!matcher.matches("warning"));
    }

    #[test]
    fn highlights_ascii_substring_match() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("err");

        assert_eq!(matcher.highlight_ranges("status error"), vec![7..10]);
    }

    #[test]
    fn highlights_case_insensitive_match() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("err");

        assert_eq!(matcher.highlight_ranges("ERR.log"), vec![0..3]);
    }

    #[test]
    fn empty_query_has_no_highlights() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("");

        assert!(matcher.highlight_ranges("status error").is_empty());
    }

    #[test]
    fn non_matching_text_has_no_highlights() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("err");

        assert!(matcher.highlight_ranges("warning").is_empty());
    }

    #[test]
    fn treats_special_characters_as_literal_text() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("^foo");

        assert!(matcher.matches("xx^FoObar"));
        assert!(!matcher.matches("xxfoobar"));
    }

    #[test]
    fn does_not_trim_whitespace_queries() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query(" ");

        assert!(matcher.has_query());
        assert!(matcher.matches("a b"));
        assert!(!matcher.matches("ab"));
    }

    #[test]
    fn supports_unicode_case_insensitive_matching() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("ä");

        assert!(matcher.matches("xxÄyy"));
        assert!(!matcher.matches("xxyy"));
    }

    #[test]
    fn highlights_unicode_case_insensitive_match() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("ä");

        assert_eq!(matcher.highlight_ranges("xxÄyy"), vec![2..4]);
    }

    #[test]
    fn highlights_full_grapheme_for_combining_text() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("e");

        assert_eq!(matcher.highlight_ranges("e\u{301}clair"), vec![0..3]);
    }

    #[test]
    fn replaces_previous_query() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("foo");
        assert!(matcher.matches("foo"));

        matcher.build_query("bar");
        assert!(!matcher.matches("foo"));
        assert!(matcher.matches("bar"));
    }
}
