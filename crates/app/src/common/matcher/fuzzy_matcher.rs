//! Case-insensitive fuzzy matching for small UI-side pickers.
//!
//! This wraps `nucleo-matcher` behind a tiny API suited for egui state.
//! Queries are built explicitly on text changes and reused during row matching.

// Stage 2 adds this module before Command Palette consumes it.
#![allow(dead_code)]

use std::ops::{Not, Range};

use nucleo_matcher::{
    Matcher, Utf32Str,
    pattern::{Atom, AtomKind, CaseMatching, Normalization},
};

use super::nucleo_highlight_ranges;

/// Reusable case-insensitive fuzzy matcher for UI text filtering.
#[derive(Debug, Clone, Default)]
pub struct FuzzyMatcher {
    matcher: Matcher,
    query: Option<Atom>,
    text_buf: Vec<char>,
    /// Reused memory buffer for `Atom::indices`, which nucleo appends into.
    indices_buf: Vec<u32>,
}

impl FuzzyMatcher {
    /// Rebuilds the compiled query for subsequent fuzzy matches.
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
                AtomKind::Fuzzy,
                false,
            )
        });
    }

    /// Returns whether a non-empty query is currently built.
    pub fn has_query(&self) -> bool {
        self.query.is_some()
    }

    /// Returns the fuzzy score for `text` against the current query.
    ///
    /// An empty query matches all input text with score `0`.
    pub fn score(&mut self, text: &str) -> Option<u16> {
        let Some(query) = self.query.as_ref() else {
            return Some(0);
        };

        query.score(Utf32Str::new(text, &mut self.text_buf), &mut self.matcher)
    }

    /// Returns whether `text` matches the current query.
    ///
    /// An empty query matches all input text.
    pub fn matches(&mut self, text: &str) -> bool {
        self.score(text).is_some()
    }

    /// Returns byte ranges for underlining the current fuzzy match inside `text`.
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

        if matched.is_none() {
            return Vec::new();
        }

        nucleo_highlight_ranges(text, &mut self.indices_buf)
    }
}

#[cfg(test)]
mod tests {
    use super::FuzzyMatcher;

    #[test]
    fn empty_query_matches_all_text() {
        let mut matcher = FuzzyMatcher::default();
        matcher.build_query("");

        assert!(!matcher.has_query());
        assert_eq!(matcher.score("alpha"), Some(0));
        assert!(matcher.matches("alpha"));
        assert!(matcher.matches(""));
    }

    #[test]
    fn empty_query_has_no_highlight_ranges() {
        let mut matcher = FuzzyMatcher::default();
        matcher.build_query("");

        assert!(matcher.highlight_ranges("alpha").is_empty());
    }

    #[test]
    fn matching_is_case_insensitive() {
        let mut matcher = FuzzyMatcher::default();
        matcher.build_query("ER");

        assert!(matcher.has_query());
        assert!(matcher.matches("status error"));
        assert!(matcher.score("ERROR").is_some());
    }

    #[test]
    fn fuzzy_matching_supports_gaps() {
        let mut matcher = FuzzyMatcher::default();
        matcher.build_query("fb");

        assert!(matcher.matches("foo bar"));
        assert_eq!(matcher.highlight_ranges("foo bar"), vec![0..1, 4..5]);
    }

    #[test]
    fn non_matching_text_returns_no_score_or_match() {
        let mut matcher = FuzzyMatcher::default();
        matcher.build_query("fb");

        assert_eq!(matcher.score("foo car"), None);
        assert!(!matcher.matches("foo car"));
        assert!(matcher.highlight_ranges("foo car").is_empty());
    }

    #[test]
    fn highlight_ranges_are_valid_byte_ranges() {
        let mut matcher = FuzzyMatcher::default();
        matcher.build_query("äb");
        let text = "xxÄyyb";

        let ranges = matcher.highlight_ranges(text);

        assert_eq!(ranges, vec![2..4, 6..7]);
        for range in ranges {
            assert!(text.is_char_boundary(range.start));
            assert!(text.is_char_boundary(range.end));
        }
    }

    #[test]
    fn highlights_full_grapheme_for_combining_text() {
        let mut matcher = FuzzyMatcher::default();
        matcher.build_query("e");

        assert_eq!(matcher.highlight_ranges("e\u{301}clair"), vec![0..3]);
    }

    #[test]
    fn replaces_previous_query() {
        let mut matcher = FuzzyMatcher::default();
        matcher.build_query("foo");
        assert!(matcher.matches("foo"));

        matcher.build_query("bar");
        assert!(!matcher.matches("foo"));
        assert!(matcher.matches("bar"));
    }
}
