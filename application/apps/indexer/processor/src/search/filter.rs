use regex::Regex;
use serde::{Deserialize, Serialize};
use std::str::FromStr;

/// Represents the definitions of search filter.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct SearchFilter {
    pub value: String,
    is_regex: bool,
    ignore_case: bool,
    is_word: bool,
}

impl SearchFilter {
    /// Creates a plain-text filter with all optional flags disabled.
    ///
    /// This is the canonical entrypoint; enable regex, case-insensitive,
    /// or word-boundary behavior with the builder-style flag setters.
    pub fn plain(value: impl Into<String>) -> Self {
        SearchFilter {
            value: value.into(),
            is_regex: false,
            ignore_case: false,
            is_word: false,
        }
    }

    /// Returns whether the filter can be compiled into its effective regex form.
    pub fn valid(&self) -> bool {
        get_filter_error(self).is_none()
    }

    /// Returns whether `value` is treated as a raw regex pattern.
    pub fn is_regex(&self) -> bool {
        self.is_regex
    }

    /// Returns whether matching should ignore letter case.
    pub fn is_ignore_case(&self) -> bool {
        self.ignore_case
    }

    /// Returns whether the filter is wrapped in word boundaries.
    pub fn is_word(&self) -> bool {
        self.is_word
    }

    /// Sets case-insensitive matching for the filter builder.
    #[must_use]
    pub fn ignore_case(mut self, ignore: bool) -> Self {
        self.ignore_case = ignore;
        self
    }

    /// Sets whether `value` should be interpreted as a raw regex pattern.
    #[must_use]
    pub fn regex(mut self, regex: bool) -> Self {
        self.is_regex = regex;
        self
    }

    /// Sets whether the effective regex is wrapped in word boundaries.
    #[must_use]
    pub fn word(mut self, word: bool) -> Self {
        self.is_word = word;
        self
    }
}

pub fn get_filter_error(filter: &SearchFilter) -> Option<String> {
    let regex_as_str = as_regex(filter);
    Regex::from_str(&regex_as_str).map_or_else(|err| Some(err.to_string()), |_| None)
}

pub fn as_regex(filter: &SearchFilter) -> String {
    let word_marker = if filter.is_word { "\\b" } else { "" };
    let ignore_case_start = if filter.ignore_case { "(?i)" } else { "" };
    let ignore_case_end = if filter.ignore_case { "(?-i)" } else { "" };
    let subject = if filter.is_regex {
        filter.value.clone()
    } else {
        regex::escape(&filter.value)
    };
    format!("{ignore_case_start}{word_marker}{subject}{word_marker}{ignore_case_end}",)
}

pub fn as_alias(filter: &SearchFilter) -> String {
    let word_marker = if filter.is_word { "1" } else { "0" };
    let ignore_case = if filter.ignore_case { "1" } else { "0" };
    let is_regex = if filter.is_regex { "1" } else { "0" };
    format!(
        "{}:{}{}{}",
        filter.value, is_regex, ignore_case, word_marker
    )
}

#[cfg(test)]
mod tests {
    use super::{SearchFilter, as_alias, as_regex};

    #[test]
    fn as_regex_escapes_plain_text() {
        let filter = SearchFilter::plain("cpu=(1.0)");

        assert_eq!(as_regex(&filter), "cpu=\\(1\\.0\\)");
    }

    #[test]
    fn as_regex_preserves_regex_with_flags() {
        let filter = SearchFilter::plain("cpu=(\\d+)")
            .regex(true)
            .ignore_case(true)
            .word(true);

        assert_eq!(as_regex(&filter), "(?i)\\bcpu=(\\d+)\\b(?-i)");
    }

    #[test]
    fn as_alias_encodes_disabled_flags() {
        let filter = SearchFilter::plain("status=ok");

        assert_eq!(as_alias(&filter), "status=ok:000");
    }

    #[test]
    fn as_alias_encodes_enabled_flags_in_order() {
        let filter = SearchFilter::plain("cpu=(\\d+)")
            .regex(true)
            .ignore_case(true)
            .word(true);

        assert_eq!(as_alias(&filter), "cpu=(\\d+):111");
    }
}
