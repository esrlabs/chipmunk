extern crate wasm_bindgen;

use regex::Regex;
use std::str::FromStr;
use wasm_bindgen::prelude::*;
use wasm_bindgen_test::*;

#[wasm_bindgen]
pub fn get_filter_error(
    filter: String,
    case_sensitive: bool,
    whole_word: bool,
    regex: bool,
) -> Option<String> {
    let regex_as_str = filter_as_regex(filter, case_sensitive, whole_word, regex);
    Regex::from_str(&regex_as_str).map_or_else(|err| Some(err.to_string()), |_| None)
}

fn filter_as_regex(filter: String, case_sensitive: bool, whole_word: bool, regex: bool) -> String {
    let word_marker = if whole_word { "\\b" } else { "" };
    let ignore_case_start = if case_sensitive { "(?i)" } else { "" };
    let ignore_case_end = if case_sensitive { "(?-i)" } else { "" };
    let subject = if regex {
        filter
    } else {
        regex::escape(&filter)
    };
    format!("{ignore_case_start}{word_marker}{subject}{word_marker}{ignore_case_end}",)
}

#[wasm_bindgen_test]
fn plain_string_regex_on() {
    let filter = String::from("Some random filter");
    let case_sesitive = false;
    let whole_word = false;
    let regex = true;
    assert_eq!(
        get_filter_error(filter, case_sesitive, whole_word, regex),
        None
    );
}

#[wasm_bindgen_test]
fn plain_string_regex_off() {
    let filter = String::from("Some random filter");
    let case_sesitive = false;
    let whole_word = false;
    let regex = false;
    assert_eq!(
        get_filter_error(filter, case_sesitive, whole_word, regex),
        None
    );
}

#[wasm_bindgen_test]
fn valid_regex() {
    let filter = String::from(r"\[Warn\]");
    let case_sesitive = false;
    let whole_word = false;
    let regex = true;
    assert_eq!(
        get_filter_error(filter, case_sesitive, whole_word, regex),
        None
    );
}

#[wasm_bindgen_test]
fn invalid_regex() {
    let filter = String::from(r"\[Warn(\]");
    let case_sesitive = false;
    let whole_word = false;
    let regex = true;
    match get_filter_error(filter, case_sesitive, whole_word, regex) {
        Some(result) => assert_eq!(
            result,
            "regex parse error:\n    \\[Warn(\\]\n          ^\nerror: unclosed group"
        ),
        None => panic!("Invalid regular expression should return error message"),
    }
}
