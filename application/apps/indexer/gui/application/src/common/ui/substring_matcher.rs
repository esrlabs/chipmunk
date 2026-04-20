//! Case-insensitive literal substring matching for small UI-side filters.
//!
//! This wraps `nucleo-matcher` behind a tiny API suited for egui state.
//! Queries are built explicitly on text changes and reused during row matching.

use std::ops::Not;

use nucleo_matcher::{
    Matcher, Utf32Str,
    pattern::{Atom, AtomKind, CaseMatching, Normalization},
};

/// Reusable case-insensitive literal substring matcher for UI text filtering.
#[derive(Debug, Clone, Default)]
pub struct SubstringMatcher {
    matcher: Matcher,
    query: Option<Atom>,
    text_buf: Vec<char>,
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
    fn replaces_previous_query() {
        let mut matcher = SubstringMatcher::default();
        matcher.build_query("foo");
        assert!(matcher.matches("foo"));

        matcher.build_query("bar");
        assert!(!matcher.matches("foo"));
        assert!(matcher.matches("bar"));
    }
}
