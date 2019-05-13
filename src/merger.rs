use chrono::format::ParseError;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime};
use regex::Regex;
use std::collections::BinaryHeap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};

pub struct Merger {
    pub source_id: String, // tag to append to each line
    pub max_lines: usize,  // how many lines to collect before writing out
    pub chunk_size: usize, // used for mapping line numbers to byte positions
}

#[derive(Clone, Eq, PartialEq)]
struct TimedLine {
    timestamp: i64,
    content: String,
    tag: String,
}

#[allow(dead_code)]
fn line_to_timed_line(
    line: &str,
    regex: &Regex,
    year: Option<u32>,
    timezone: Option<&str>,
) -> Option<TimedLine> {
    let timestamp_capture = regex.captures(line).expect("could not capture regex");
    let timestamp_str = timestamp_capture
        .get(1)
        .expect("could not find regex")
        .as_str();
    println!("timestamp: {}", timestamp_str);
    let mut timestamp_string = timestamp_str.to_string();
    let mut timestamp = 0;
    match year {
        Some(y) => {
            timestamp_string.insert_str(0, &(y.to_string() + ":")[..]);
            let d = DateTime::parse_from_str(&timestamp_string[..], "%Y:%m-%d %H:%M:%S.%f %z")
                .expect("could not parse date");
            timestamp = d.timestamp();
        }
        None => {
            let d = DateTime::parse_from_str(timestamp_str, "%m-%d-%Y %H:%M:%S.%f")
                .expect("could not parse date");
            timestamp = d.timestamp();
        }
    }

    Some(TimedLine {
        timestamp,
        content: line.to_string(),
        tag: String::new(),
    })
}

impl Merger {
    #[allow(dead_code)]
    pub fn merge_file(
        &self,
        files_to_merge: Vec<(std::path::PathBuf, Regex)>,
        out_path: &std::path::PathBuf,
        append: bool,
    ) -> ::std::result::Result<Vec<String>, failure::Error> {
        let mut readers_with_regex = files_to_merge.iter().map(|(p, r)| {
            (
                BufReader::new(fs::File::open(p).expect("could not open file")),
                r,
            )
        });
        return Ok(vec![]);
    }
}
#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn test_parse_date_line_no_year() {
        let re = Regex::new(r"^(\d{1,2}-\d{1,2}\s+\d{1,2}:\d{1,2}:\d{1,2}.\d+\s\+\d+)").unwrap();
        let input = "04-04 11:52:50.229 +0200 D/oup.csc(  665): [728] MqttLogger";
        let TimedLine {
            timestamp,
            content,
            tag,
        } = line_to_timed_line(input, &re, Some(2017), None).unwrap();
        println!("timestamp: {}, tag: {}", timestamp, tag);
        assert_eq!(1491299570, timestamp);
    }
    #[test]
    fn test_parse_date_line_no_year_no_timezone() {
        let re = Regex::new(r"^(\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}.\d+)\s").unwrap();
        let input =
            "05-02-2019 12:36:36.506 0 0.764564113869644 0.7033032911158661 0.807587397462308";
        let TimedLine {
            timestamp,
            content,
            tag,
        } = line_to_timed_line(input, &re, None, None).unwrap();
        println!("timestamp: {}, tag: {}", timestamp, tag);
    }
}
