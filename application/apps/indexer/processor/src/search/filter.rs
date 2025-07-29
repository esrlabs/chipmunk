use regex::Regex;
use serde::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SearchFilter {
    pub value: String,
    is_regex: bool,
    ignore_case: bool,
    is_word: bool,
    pub invert: bool,
}

impl SearchFilter {
    pub fn new(
        value: String,
        is_regex: bool,
        ignore_case: bool,
        is_word: bool,
        invert: bool,
    ) -> Self {
        SearchFilter {
            value,
            is_regex,
            ignore_case,
            is_word,
            invert,
        }
    }

    pub fn plain(value: &str) -> Self {
        SearchFilter {
            value: value.into(),
            is_regex: false,
            ignore_case: false,
            is_word: false,
            invert: false,
        }
    }

    /// Validate filter. Checks possibility to convert filter
    /// to RegEx considering filter's options
    ///
    /// # Returns
    ///
    /// `true` in case of valid condition; `false` - invalid
    ///
    pub fn valid(&self) -> bool {
        get_filter_error(self).is_none()
    }

    #[must_use]
    pub fn ignore_case(mut self, ignore: bool) -> Self {
        self.ignore_case = ignore;
        self
    }

    #[must_use]
    pub fn regex(mut self, regex: bool) -> Self {
        self.is_regex = regex;
        self
    }

    #[must_use]
    pub fn word(mut self, word: bool) -> Self {
        self.is_word = word;
        self
    }

    #[must_use]
    pub fn invert(mut self, invert: bool) -> Self {
        self.invert = invert;
        self
    }
}

pub fn get_filter_error(filter: &SearchFilter) -> Option<String> {
    let regex_info = as_regex(filter);
    Regex::from_str(&regex_info).map_or_else(|err| Some(err.to_string()), |_| None)
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

    format!("{ignore_case_start}{word_marker}{subject}{word_marker}{ignore_case_end}")
}

pub fn as_alias(filter: &SearchFilter) -> String {
    let word_marker = if filter.is_word { "1" } else { "0" };
    let ignore_case = if filter.ignore_case { "1" } else { "0" };
    let is_regex = if filter.is_regex { "1" } else { "0" };
    let invert = if filter.invert { "1" } else { "0" };
    format!(
        "{}:{}{}{}{}",
        filter.value, is_regex, ignore_case, word_marker, invert
    )
}
