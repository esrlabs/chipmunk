use crate::parse::*;
use crate::utils;
use regex::Regex;
use std::cmp::Ordering;
use std::fs::File;
use std::io::{BufRead, BufReader};

#[derive(Clone, Eq, PartialEq, Debug)]
pub struct TimedLine {
    pub timestamp: i64,
    pub content: String,
    pub tag: String,
    pub original_length: usize,
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
pub struct TimedLineIter<'a> {
    reader: BufReader<File>,
    tag: &'a str,
    regex: &'a Regex,
    year: Option<i32>,
    time_offset: Option<i64>,
    last_timestamp: i64,
}
impl<'a> TimedLineIter<'a> {
    pub fn new(
        fh: File,
        tag: &'a str,
        regex: &'a Regex,
        year: Option<i32>,
        time_offset: Option<i64>,
    ) -> TimedLineIter<'a> {
        TimedLineIter {
            reader: BufReader::new(fh),
            tag,
            regex,
            year,
            time_offset,
            last_timestamp: 0,
        }
    }
}
impl<'a> Iterator for TimedLineIter<'a> {
    type Item = TimedLine;
    fn next(&mut self) -> Option<TimedLine> {
        let mut buf = vec![];
        match self.reader.read_until(b'\n', &mut buf) {
            Ok(len) => {
                if len == 0 {
                    return None;
                }
                let original_line_length = len;
                let s = unsafe { std::str::from_utf8_unchecked(&buf) };
                let trimmed_line = s.trim_matches(utils::is_newline);
                let timed_line = line_to_timed_line(
                    trimmed_line,
                    original_line_length,
                    self.tag,
                    self.regex,
                    self.year,
                    self.time_offset,
                )
                .unwrap_or_else(|| TimedLine {
                    content: trimmed_line.to_string(),
                    tag: self.tag.to_string(),
                    timestamp: self.last_timestamp,
                    original_length: original_line_length,
                });
                self.last_timestamp = timed_line.timestamp;
                Some(timed_line)
            }
            Err(_) => None,
        }
    }
}
