// Copyright (c) 2019 E.S.R.Labs. All rights reserved.
//
// NOTICE:  All information contained herein is, and remains
// the property of E.S.R.Labs and its suppliers, if any.
// The intellectual and technical concepts contained herein are
// proprietary to E.S.R.Labs and its suppliers and may be covered
// by German and Foreign Patents, patents in process, and are protected
// by trade secret or copyright law.
// Dissemination of this information or reproduction of this material
// is strictly forbidden unless prior written permission is obtained
// from E.S.R.Labs.
use std::cmp::Ordering;

pub trait FooEntry {
    fn timestamp(&self) -> i64;
    fn content(&self) -> &String;
    fn tag(&self) -> &String;
    fn original_length(&self) -> usize;
    fn year_was_missing(&self) -> bool;
    fn line_nr(&self) -> usize;
}

impl FooEntry for TimedLine {
    fn timestamp(&self) -> i64 {
        self.timestamp
    }
    fn content(&self) -> &String {
        &self.content
    }
    fn tag(&self) -> &String {
        &self.tag
    }
    fn original_length(&self) -> usize {
        self.original_length
    }
    fn year_was_missing(&self) -> bool {
        self.year_was_missing
    }
    fn line_nr(&self) -> usize {
        self.line_nr
    }
}

#[derive(Clone, Eq, PartialEq, Debug)]
pub struct TimedLine {
    pub timestamp: i64,
    pub content: String,
    pub tag: String,
    pub original_length: usize,
    pub year_was_missing: bool,
    pub line_nr: usize,
}

impl Ord for TimedLine {
    fn cmp(&self, other: &TimedLine) -> Ordering {
        self.timestamp.cmp(&other.timestamp)
    }
}
impl PartialOrd for TimedLine {
    fn partial_cmp(&self, other: &TimedLine) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
