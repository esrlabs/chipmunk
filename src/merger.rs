use regex::Regex;
// use std::collections::BinaryHeap;
use chrono::{NaiveDate, NaiveDateTime};
use std::fs;
use std::io::BufReader;

#[allow(dead_code)]
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
fn offset_from_timezone_in_ms(timezone: &str) -> i64 {
    let positive: bool = timezone.starts_with('+');
    let absolute_hours: &i64 = &timezone[1..3].parse().expect("could not parse timezone");
    let absolute_minutes: &i64 = &timezone[3..5].parse().expect("could not parse timezone");
    let absolute = 1000 * (3600 * *absolute_hours + 60 * (*absolute_minutes));
    if positive {
        absolute
    } else {
        -absolute
    }
}
#[allow(dead_code)]
fn line_to_timed_line(
    line: &str,
    regex: &Regex,
    year: Option<i32>,
    time_offset: Option<i64>,
) -> Option<TimedLine> {
    let caps = regex.captures(line).expect("could not capture regex");
    let (day, month): (u32, u32) = (
        caps["day"].parse().expect("error parsing day"),
        caps["month"].parse().expect("error parsing month"),
    );
    println!("d,m: {:?}", (day, month));
    let (hour, minutes, seconds, millis): (u32, u32, u32, u32) = (
        caps["hour"].parse().expect("error parsing hours"),
        caps["minutes"].parse().expect("error parsing minutes"),
        caps["seconds"].parse().expect("error parsing seconds"),
        caps["millis"].parse().expect("error parsing millis"),
    );
    println!("h,m,s,ms: {:?}", (hour, minutes, seconds, millis));

    let timezone_n = caps.name("timezone");
    if time_offset.is_none() && timezone_n.is_none() {
        eprintln!("timestamp cannot be applied");
        return None;
    }
    let offset = if time_offset.is_none() {
        offset_from_timezone_in_ms(&caps["timezone"])
    } else {
        time_offset.unwrap()
    };
    let the_year: Option<i32> = match caps.name("year") {
        Some(year_str) => year_str.as_str().parse().ok(),
        None => year,
    };
    match the_year {
        Some(y) => {
            let date_time: NaiveDateTime =
                NaiveDate::from_ymd(y, month, day).and_hms_milli(hour, minutes, seconds, millis);
            let unix_timestamp = date_time.timestamp_millis();
            Some(TimedLine {
                timestamp: unix_timestamp - offset,
                content: line.to_string(),
                tag: String::new(),
            })
        }
        None => None,
    }
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
    fn test_offset_from_timezone_in_ms() {
        assert_eq!(0, offset_from_timezone_in_ms("+0000"));
        assert_eq!(0, offset_from_timezone_in_ms("-0000"));
        assert_eq!(2 * 3600 * 1000, offset_from_timezone_in_ms("+0200"));
        assert_eq!(
            2 * 3600 * 1000 + 30 * 60 * 1000,
            offset_from_timezone_in_ms("+0230")
        );
        assert_eq!(-2 * 3600 * 1000, offset_from_timezone_in_ms("-0200"));
    }

    #[test]
    fn test_parse_date_line_no_year_with_timezone() {
        // let re = Regex::new(r"^(\d{1,2}-\d{1,2}\s+\d{1,2}:\d{1,2}:\d{1,2}.\d+\s\+\d+)").unwrap();
        let re = Regex::new(
            r"(?x)
^(?P<day>\d{2})-(?P<month>\d{2})
\s+
(?P<hour>\d{2}):(?P<minutes>\d{2}):(?P<seconds>\d{2}).(?P<millis>\d+)
\s
(?P<timezone>[\+\-]\d+)",
        )
        .unwrap();
        let input = "04-04 11:52:50.229 +0200 D/oup.csc(  665): [728] MqttLogger";
        let TimedLine {
            timestamp,
            content,
            tag,
        } = line_to_timed_line(input, &re, Some(2017), None).unwrap();
        println!("timestamp: {}, tag: {}", timestamp, tag);
        assert_eq!(1491299570229, timestamp);
    }
    #[test]
    #[ignore]
    fn test_parse_date_line_year_no_timezone() {
        let re = Regex::new(r"^(\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}.\d+)\s").unwrap();
        let input =
            "05-02-2019 12:36:36.506 0 0.764564113869644 0.7033032911158661 0.807587397462308";
        let TimedLine {
            timestamp,
            content,
            tag,
        } = line_to_timed_line(input, &re, None, Some(0)).unwrap();
        println!("timestamp: {}, tag: {}", timestamp, tag);
    }
}
