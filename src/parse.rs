use crate::timedline::*;
use chrono::{NaiveDate, NaiveDateTime};
use lazy_static::lazy_static;
use nom::*;
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;

const LINES_TO_INSPECT: usize = 10;
const LINE_DETECTION_THRESHOLD: usize = 5;

pub fn line_to_timed_line(
    line: &str,
    original_line_length: usize,
    tag: &str,
    regex: &Regex,
    year: Option<i32>,
    time_offset: Option<i64>,
) -> Option<TimedLine> {
    let caps = regex.captures(line)?;
    let (day, month): (u32, u32) = (
        caps["d"].parse().expect("error parsing day"),
        caps["m"].parse().expect("error parsing month"),
    );
    let (hour, minutes, seconds, millis): (u32, u32, u32, u32) = (
        caps["H"].parse().expect("error parsing hours"),
        caps["M"].parse().expect("error parsing minutes"),
        caps["S"].parse().expect("error parsing seconds"),
        caps["millis"].parse().expect("error parsing millis"),
    );

    let timezone_n = caps.name("timezone");
    if time_offset.is_none() && timezone_n.is_none() {
        eprintln!("timestamp cannot be applied");
        return None;
    }
    let offset_result = if time_offset.is_none() {
        offset_from_timezone_in_ms(&caps["timezone"])
    } else {
        time_offset.ok_or_else(|| failure::err_msg("could not detect timestamp in"))
    };
    let the_year: Option<i32> = match caps.name("Y") {
        Some(year_str) => year_str.as_str().parse().ok(),
        None => year,
    };
    match (the_year, offset_result) {
        (Some(y), Ok(offset)) => {
            // eprintln!("(y, month, day) = {:?}", (y, month, day));
            // eprintln!(
            //     "(hour, minutes, seconds, millis) = {:?}",
            //     (hour, minutes, seconds, millis)
            // );
            let date_time: NaiveDateTime =
                NaiveDate::from_ymd(y, month, day).and_hms_milli(hour, minutes, seconds, millis);
            let unix_timestamp = date_time.timestamp_millis();
            Some(TimedLine {
                timestamp: unix_timestamp - offset,
                content: line.to_string(),
                tag: tag.to_string(),
                original_length: original_line_length,
            })
        }
        (None, Ok(_)) => {
            eprintln!("could not determine the year!");
            None
        }
        (Some(_), Err(e)) => {
            eprintln!("could not determine the timezone or offset! ({})", e);
            None
        }
        (None, Err(_)) => {
            eprintln!("could not determine the year and timezone or offset!");
            None
        }
    }
}

#[derive(Debug, PartialEq, Eq, Hash, Clone)]
pub enum RegexKind {
    /// use R1 for files with this kind of timestamp: "04-04 11:52:50.229 +0200 ...";
    /// contains timezone but no year
    R1 = 1,
    /// use R2 for files with this kind of timestamp: "04-04-2017 11:52:50.229 ...";
    /// contains year but no timezone
    R2 = 2,
}
impl RegexKind {
    #[allow(dead_code)]
    pub fn from_u32(value: u32) -> RegexKind {
        match value {
            1 => RegexKind::R1,
            2 => RegexKind::R2,
            _ => panic!("Unknown value: {}", value),
        }
    }
}
// %Y	2001	The full proleptic Gregorian year, zero-padded to 4 digits
// %m	07	Month number (01--12), zero-padded to 2 digits.
// %d	08	Day number (01--31), zero-padded to 2 digits.
// %H	00	Hour number (00--23), zero-padded to 2 digits.
// %M	34	Minute number (00--59), zero-padded to 2 digits.
// %S	60	Second number (00--60), zero-padded to 2 digits
lazy_static! {
    pub static ref REGEX_REGISTRY: HashMap<RegexKind, Regex> = {
        let mut m = HashMap::new();

        // 05-22 12:36:36.506 +0100 I/GKI_LINUX1
        m.insert(RegexKind::R1, Regex::new(
            r"(?x)(?P<m>\d{2})-(?P<d>\d{2})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2}).(?P<millis>\d+)\s(?P<timezone>[\+\-]\d+)"
        ).unwrap());

        // 05-22-2019 12:36:04.344 A0
        m.insert(RegexKind::R2, Regex::new(
            r"(?x)(?P<m>\d{2})-(?P<d>\d{2})-(?P<Y>\d{4})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2}).(?P<millis>\d+)",
        ).unwrap());
        m
    };
    static ref REGEX_COUNT: usize = REGEX_REGISTRY.len();
}

pub fn detect_timestamp_regex(path: &Path) -> Result<RegexKind, failure::Error> {
    let f: fs::File = fs::File::open(path)?;
    let mut reader: BufReader<&std::fs::File> = BufReader::new(&f);

    let mut buf = vec![];
    let mut matched_lines_regex_01 = 0;
    let mut matched_lines_regex_02 = 0;
    let mut inspected_lines = 0;
    while let Ok(len) = reader.read_until(b'\n', &mut buf) {
        if len == 0 {
            break; // file is done
        }
        let s = unsafe { std::str::from_utf8_unchecked(&buf) };
        matched_lines_regex_01 = match line_to_timed_line(
            s,
            len,
            "TAG",
            &REGEX_REGISTRY[&RegexKind::R1],
            Some(3333),
            Some(0),
        ) {
            Some(_) => matched_lines_regex_01 + 1,
            None => matched_lines_regex_01,
        };
        matched_lines_regex_02 = match line_to_timed_line(
            s,
            len,
            "TAG",
            &REGEX_REGISTRY[&RegexKind::R2],
            Some(3333),
            Some(0),
        ) {
            Some(_) => matched_lines_regex_02 + 1,
            None => matched_lines_regex_02,
        };
        if !s.trim().is_empty() {
            inspected_lines += 1;
        }
        buf = vec![];
        if inspected_lines > LINES_TO_INSPECT {
            break;
        }
    }
    let min_matched_lines = std::cmp::min(LINE_DETECTION_THRESHOLD, inspected_lines);
    if matched_lines_regex_01 >= min_matched_lines
        && matched_lines_regex_01 > matched_lines_regex_02
    {
        return Ok(RegexKind::R1);
    }
    if matched_lines_regex_02 >= min_matched_lines
        && matched_lines_regex_02 > matched_lines_regex_01
    {
        return Ok(RegexKind::R2);
    }
    eprintln!("could not detect timestamp in {:?}", path);
    Err(failure::err_msg(format!(
        "could not detect timestamp in {:?}",
        path
    )))
}

#[derive(Debug, PartialEq)]
pub struct Line {
    pub month: u32,
    pub day: u32,
    pub year: u32,
    pub hour: u32,
    pub minute: u32,
    pub seconds: u32,
    pub millis: u32,
    pub timezone: String,
}
#[allow(dead_code)]
pub fn from_digits(input: &str) -> Result<u32, std::num::ParseIntError> {
    u32::from_str_radix(input, 10)
}

#[allow(dead_code)]
fn is_digit(c: char) -> bool {
    c.is_digit(10)
}
fn not_nl(c: char) -> bool {
    c == '\n'
}
fn any(_c: char) -> bool {
    true
}
named!(match_ws<char>, char!(' '));
named!(num_primary<&str, u32>,
  map_res!(take_while_m_n!(2, 2, is_digit), from_digits)
);
named!(num_primary4<&str, u32>,
  map_res!(take_while_m_n!(2, 4, is_digit), from_digits)
);
named!(any_s<&str, &str>,
    take_while!(not_nl)
);
named!( alpha<&str, &str>, take_while!( char::is_alphabetic ) );
// named!( complete<&str, Line>,
//     alt!(date_parser | anychar >> complete)
// );

named!(date_parser<&str, Line>,
  do_parse!(
    month:   num_primary >>
    tag!("-")   >>
    day: num_primary >>
    tag!("-")   >>
    year:  num_primary4 >>
    tag!(" ")   >>
    hour:  num_primary >>
    tag!(":")   >>
    minute:  num_primary >>
    tag!(":")   >>
    seconds:  num_primary >>
    tag!(".")   >>
    millis: ms >>
    (Line { month, day, year, hour, minute, seconds, millis, timezone: "".to_string() })
  )
);
named!(timezone<&str, String>,
    do_parse!(
        sign: tag!("+") >>
        tz: take_while!(is_digit) >> (format!("{}{}", sign, tz))
    )
);
// 05-14 12:26:04.344 +0200
named!(date_parser2<&str, Line>,
  do_parse!(
    month:   num_primary >>
    tag!("-")   >>
    day: num_primary >>
    tag!(" ")   >>
    hour:  num_primary >>
    tag!(":")   >>
    minute:  num_primary >>
    tag!(":")   >>
    seconds:  num_primary >>
    tag!(".")   >>
    millis: ms >>
    tag!(" ") >>
    timezone: timezone >>
    (Line { month, day, year: 2019, hour, minute, seconds, millis, timezone })
  )
);
named!(ms<&str, u32>, map_res!(complete!(take_while!(is_digit)), from_digits));
#[allow(dead_code)]
pub fn line_to_timed_line_nom(
    line: &str,
    original_line_length: usize,
    tag: &str,
    year: Option<i32>,
    time_offset: Option<i64>,
) -> Option<TimedLine> {
    if let Ok((rest, l)) = date_parser2(line) {
        let mut y = l.year as i32;
        if let Some(year) = year {
            y = year;
        }
        let date_time: NaiveDateTime = NaiveDate::from_ymd(y, l.month, l.day)
            .and_hms_milli(l.hour, l.minute, l.seconds, l.millis);
        let unix_timestamp = date_time.timestamp_millis();
        return match time_offset {
            Some(offset) => Some(TimedLine {
                timestamp: unix_timestamp - offset,
                content: line.to_string(),
                tag: tag.to_string(),
                original_length: original_line_length,
            }),
            None => Some(TimedLine {
                timestamp: unix_timestamp
                    - offset_from_timezone_in_ms(l.timezone.as_str())
                        .expect("could not get offset from timezone"),
                content: line.to_string(),
                tag: tag.to_string(),
                original_length: original_line_length,
            }),
        };
    }
    None
}

fn offset_from_timezone_in_ms(timezone: &str) -> Result<i64, failure::Error> {
    let positive: bool = timezone.starts_with('+');
    let absolute_hours: &i64 = &timezone[1..3].parse().expect("could not parse timezone");
    let absolute_minutes: &i64 = &timezone[3..5].parse().expect("could not parse timezone");
    let absolute = 1000 * (3600 * *absolute_hours + 60 * (*absolute_minutes));
    if positive {
        Ok(absolute)
    } else {
        Ok(-absolute)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    named!(ms2<&str, u32>, map_res!(complete!(take_while!(is_digit)), from_digits));
    #[test]
    fn mini() {
        assert_eq!(alpha("abc123"), Ok(("123", "abc")));
        // assert_eq!(alpha("abc"), Ok(("", "abc")));
        assert_eq!(ms_s("123abc"), Ok(("abc", "123")));
        assert_eq!(ms2("123abc"), Ok(("abc", 123)));
        // assert_eq!(ms2("123"), Ok(("", 123)));
        // assert_eq!(ms("123"), Ok(("", 123)))
    }

    // named!(parsertest<&str, String>, preceded!(many0!( any_s ), timezone));
    named!(p<&str, &str>, preceded!(tag!("ab"), tag!("XY")));
    named!(parsertest<&str, Vec<&str>>, many0!( ms_s ));
    named!(ms_s<&str, &str>, take_while!(is_digit));
    #[test]
    fn basic_preceed() {
        // assert_eq!(Ok(("\n", "+0200".to_string())), parsertest("#+0200\n"),);
        assert_eq!(Ok(("Z", "XY")), p("abXYZ"));
        // assert_eq!(Ok(("\n", vec!["+0200"])), parsertest("23230200\n"),);
    }
    #[test]
    fn basic_nom() {
        assert_eq!(
            Ok((
                " 0 0.764564113869644 0.7033032911158661 0.807587397462308",
                Line {
                    month: 5,
                    day: 14,
                    year: 2019,
                    hour: 12,
                    minute: 26,
                    seconds: 4,
                    millis: 344,
                    timezone: "".to_string(),
                }
            )),
            date_parser(
                "05-14-2019 12:26:04.344 0 0.764564113869644 0.7033032911158661 0.807587397462308"
            ),
        );
        assert_eq!(
            Ok((
                " D/oup.csc(  665): [728] MqttLogger",
                Line {
                    month: 5,
                    day: 14,
                    year: 2019,
                    hour: 12,
                    minute: 26,
                    seconds: 4,
                    millis: 344,
                    timezone: "+0200".to_string(),
                }
            )),
            date_parser2("05-14 12:26:04.344 +0200 D/oup.csc(  665): [728] MqttLogger"),
        );
    }
    #[test]
    fn test_offset_from_timezone_in_ms() {
        assert_eq!(
            0,
            offset_from_timezone_in_ms("+0000").expect("could not parse")
        );
        assert_eq!(
            0,
            offset_from_timezone_in_ms("-0000").expect("could not parse")
        );
        assert_eq!(
            2 * 3600 * 1000,
            offset_from_timezone_in_ms("+0200").expect("could not parse")
        );
        assert_eq!(
            2 * 3600 * 1000 + 30 * 60 * 1000,
            offset_from_timezone_in_ms("+0230").expect("could not parse")
        );
        assert_eq!(
            -2 * 3600 * 1000,
            offset_from_timezone_in_ms("-0200").expect("could not parse")
        );
    }

    #[test]
    fn test_parse_date_line_no_year_with_timezone() {
        let input = "04-04 11:52:50.229 +0200 D/oup.csc(  665): [728] MqttLogger";
        {
            {
                let TimedLine {
                    timestamp,
                    content,
                    tag,
                    ..
                } = line_to_timed_line(
                    input,
                    input.len(),
                    "TAG",
                    &REGEX_REGISTRY[&RegexKind::R1],
                    Some(2017),
                    None,
                )
                .unwrap();
                println!("timestamp: {}, tag: {}", timestamp, tag);
                assert_eq!(1_491_299_570_229, timestamp);
                assert_eq!(input, content);
            }
            {
                let TimedLine {
                    timestamp,
                    content,
                    tag,
                    ..
                } = line_to_timed_line_nom(input, input.len(), "TAG", Some(2017), None).unwrap();
                println!("timestamp: {}, tag: {}", timestamp, tag);
                assert_eq!(1_491_299_570_229, timestamp);
                assert_eq!(input, content);
            }
        }
    }
    const TWO_HOURS_IN_MS: i64 = 2 * 3600 * 1000;
    #[test]
    fn test_parse_date_line_year_no_timezone() {
        let input =
            "04-04-2017 11:52:50.229 0 0.764564113869644 0.7033032911158661 0.807587397462308";
        {
            let TimedLine {
                timestamp,
                content,
                tag,
                ..
            } = line_to_timed_line(
                input,
                input.len(),
                "TAG",
                &REGEX_REGISTRY[&RegexKind::R2],
                None,
                Some(TWO_HOURS_IN_MS),
            )
            .unwrap();
            println!("timestamp: {}, tag: {}", timestamp, tag);
            assert_eq!(1_491_299_570_229, timestamp);
            assert_eq!(input, content);
        }

        // {
        //     let TimedLine {
        //         timestamp,
        //         content,
        //         tag,
        //         ..
        //     } = line_to_timed_line_nom(input, input.len(), "TAG", None, Some(TWO_HOURS_IN_MS))
        //         .unwrap();
        //     println!("timestamp: {}, tag: {}", timestamp, tag);
        //     assert_eq!(1_491_299_570_229, timestamp);
        //     assert_eq!(input, content);
        // }
    }

    test_generator::test_expand_paths! { test_detect_regex; "test_samples/detecting/*" }

    fn test_detect_regex(dir_name: &str) {
        let in_path = PathBuf::from(&dir_name).join("in.log");
        let res = detect_timestamp_regex(&in_path).expect("could not detect regex type");

        let mut format_path = PathBuf::from(&dir_name);
        format_path.push("expected.format");
        let contents =
            fs::read_to_string(format_path).expect("Something went wrong reading the file");
        let expected_regex_number: u32 = contents
            .trim()
            .parse()
            .expect("could not parse expected format");
        let expected_regex_kind = RegexKind::from_u32(expected_regex_number);
        assert_eq!(expected_regex_kind, res);
    }

}
