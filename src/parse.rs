use crate::timedline::TimedLine;
use chrono::{NaiveDate, NaiveDateTime, Utc, Datelike};
use std::borrow::Cow;
use nom::bytes::complete::tag;

use nom::character::complete::{char, digit1};
use nom::combinator::{map, map_res, opt};
use nom::multi::{fold_many0, many1};
use nom::IResult;

use regex::Regex;
use serde::{Deserialize, Serialize};

use std::collections::{HashMap, HashSet};
use std::fs;

use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};

const LINES_TO_INSPECT: usize = 10;
const LINE_DETECTION_THRESHOLD: usize = 5;

#[derive(Debug, PartialEq, Eq, Hash, Clone)]
pub enum FormatPiece {
    Day,
    Month,
    Year,
    Hour,
    Minute,
    Second,
    Fraction,
    TimeZone,
    AbsoluteMilliseconds,
    SeperatorChar(char),
    Seperator(String),
}
impl std::fmt::Display for FormatPiece {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            FormatPiece::Day => write!(f, "Day"),
            FormatPiece::Month => write!(f, "Month"),
            FormatPiece::Year => write!(f, "Year"),
            FormatPiece::Hour => write!(f, "Hour"),
            FormatPiece::Minute => write!(f, "Minute"),
            FormatPiece::Second => write!(f, "Second"),
            FormatPiece::Fraction => write!(f, "Fraction"),
            FormatPiece::TimeZone => write!(f, "TimeZone"),
            FormatPiece::AbsoluteMilliseconds => write!(f, "AbsoluteMilliseconds"),
            FormatPiece::SeperatorChar(_) => write!(f, "SeperatorChar"),
            FormatPiece::Seperator(_) => write!(f, "Seperator"),
        }
    }
}
/// takes a format string for a date representation and tokenize it
/// into it's individual elements
/// e.g. "DD-MM" => [Day,Seperator("-"),Month]
///      YYYY = four-digit year
///      MM   = two-digit month (01=January, etc.)
///      DD   = two-digit day of month (01 through 31)
///      hh   = two digits of hour (00 through 23) (am/pm NOT allowed)
///      mm   = two digits of minute (00 through 59)
///      ss   = two digits of second (00 through 59)
///      s    = one or more digits representing a decimal fraction of a second
///      TZD  = time zone designator (Z or +hh:mm or -hh:mm)
static DAY_FORMAT_TAG: &str = "DD";
static MONTH_FORMAT_TAG: &str = "MM";
static YEAR_FORMAT_TAG: &str = "YYYY";
static HOURS_FORMAT_TAG: &str = "hh";
static MINUTES_FORMAT_TAG: &str = "mm";
static SECONDS_FORMAT_TAG: &str = "ss";
static TIMEZONE_FORMAT_TAG: &str = "TZD";
const FRACTION_FORMAT_CHAR: char = 's';

fn days(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(DAY_FORMAT_TAG), |_| FormatPiece::Day)(input)
}
fn month(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(MONTH_FORMAT_TAG), |_| FormatPiece::Month)(input)
}
fn year(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(YEAR_FORMAT_TAG), |_| FormatPiece::Year)(input)
}
fn hours(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(HOURS_FORMAT_TAG), |_| FormatPiece::Hour)(input)
}
fn minutes(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(MINUTES_FORMAT_TAG), |_| FormatPiece::Minute)(input)
}
fn seconds(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(SECONDS_FORMAT_TAG), |_| FormatPiece::Second)(input)
}
fn fraction(input: &str) -> IResult<&str, FormatPiece> {
    map(nom::character::complete::char(FRACTION_FORMAT_CHAR), |_| {
        FormatPiece::Fraction
    })(input)
}
fn timezone(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(TIMEZONE_FORMAT_TAG), |_| FormatPiece::TimeZone)(input)
}
fn absolute_millis(input: &str) -> IResult<&str, FormatPiece> {
    map(tag("sss"), |_| FormatPiece::AbsoluteMilliseconds)(input)
}
fn many_spaces(input: &str) -> IResult<&str, char> {
    map(many1(nom::character::complete::char(' ')), |_| ' ')(input)
}
fn seperator(input: &str) -> IResult<&str, FormatPiece> {
    map(
        nom::branch::alt((many_spaces, nom::character::complete::anychar)),
        FormatPiece::SeperatorChar,
    )(input)
}
fn any_date_format(input: &str) -> IResult<&str, FormatPiece> {
    nom::branch::alt((
        days,
        month,
        year,
        hours,
        minutes,
        absolute_millis,
        seconds,
        fraction,
        timezone,
        seperator,
    ))(input)
}
fn escape_metacharacters(c: char) -> Cow<'static, str> {
    match c {
        //  .|?*+(){}[]DD
        ' ' => r"\s+",
        '.' => r"\.",
        '|' => r"\|",
        '?' => r"\?",
        '+' => r"\+",
        '(' => r"\(",
        ')' => r"\)",
        '[' => r"\[",
        '{' => r"\{",
        '^' => r"\^",
        '$' => r"\$",
        '*' => r"\*",
        _ => return c.to_string().into(),
    }.into()
}
pub fn date_expression(input: &str) -> IResult<&str, Vec<FormatPiece>> {
    let parser = fold_many0(
        any_date_format,
        (String::from(""), Vec::new()),
        |mut acc: (String, Vec<_>), item| {
            match item {
                FormatPiece::SeperatorChar(c) => acc.0.push_str(&escape_metacharacters(c)),
                _ => {
                    if !acc.0.is_empty() {
                        acc.1.push(FormatPiece::Seperator(acc.0));
                        acc.0 = String::from("")
                    }
                    acc.1.push(item)
                }
            };
            acc
        },
    );
    map(parser, |p: (String, Vec<FormatPiece>)| {
        if !p.0.is_empty() {
            let mut res_vec = p.1;
            res_vec.push(FormatPiece::Seperator(p.0));
            return res_vec;
        }
        p.1
    })(input)
}

pub fn date_format_str_to_regex(date_format: &str) -> Result<Regex, failure::Error> {
    if date_format.is_empty() {
        return Err(failure::err_msg("cannot construct regex from empty string"));
    }
    let format_pieces = date_expression(date_format);

    match format_pieces {
        Ok(r) => {
            if r.1.is_empty() {
                return Err(failure::err_msg("could not create regex"));
            }
            let s = r.1.iter().fold(String::from(r""), |mut acc, x| {
                let part = format_piece_as_regex_string(x);
                acc.push_str(part.as_str());
                acc
            });

            if let Ok(regex) = Regex::new(s.as_str()) {
                return Ok(regex);
            }
            return Err(failure::err_msg("could not create regex"));
        }
        Err(e) => eprintln!("{:?}", e),
    }
    Err(failure::err_msg("could not detect timestamp in"))
}
static DAY_GROUP: &str = "d";
static MONTH_GROUP: &str = "m";
static YEAR_GROUP: &str = "Y";
static HOUR_GROUP: &str = "H";
static MINUTE_GROUP: &str = "M";
static SECONDS_GROUP: &str = "S";
static FRACTION_GROUP: &str = "millis";
static TIMEZONE_GROUP: &str = "timezone";
static ABSOLUTE_MS_GROUP: &str = "absolute";

fn named_group(regex: &str, capture_id: &str) -> String {
    format!(r"(?P<{}>{})", capture_id, regex)
}

fn format_piece_as_regex_string(p: &FormatPiece) -> String {
    match p {
        FormatPiece::Day => named_group(r"\d{2}", DAY_GROUP),
        FormatPiece::Month => named_group(r"\d{2}", MONTH_GROUP),
        FormatPiece::Year => named_group(r"\d{4}", YEAR_GROUP),
        FormatPiece::Hour => named_group(r"\d{2}", HOUR_GROUP),
        FormatPiece::Minute => named_group(r"\d{2}", MINUTE_GROUP),
        FormatPiece::Second => named_group(r"\d{2}", SECONDS_GROUP),
        FormatPiece::Fraction => named_group(r"\d+", FRACTION_GROUP),
        FormatPiece::TimeZone => named_group(r"[\+\-]\d+", TIMEZONE_GROUP),
        FormatPiece::AbsoluteMilliseconds => named_group(r"\d+", ABSOLUTE_MS_GROUP),
        FormatPiece::SeperatorChar(c) => {
            let mut s = String::from("");
            s.push(*c);
            s
        }
        FormatPiece::Seperator(s) => s.to_string(),
    }
}
#[derive(Serialize, Deserialize, Debug)]
pub struct FormatStringMatches {
    pub regex: String,
    pub matching_lines: usize,
    pub nonmatching_lines: usize,
    pub processed_bytes: usize,
}
#[derive(Serialize, Deserialize, Debug)]
pub struct FormatTestOptions {
    pub file: String,
    pub lines_to_test: i64,
    pub format: String,
}

pub fn read_format_string_options(f: &mut fs::File) -> Result<FormatTestOptions, failure::Error> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)
        .expect("something went wrong reading the file");
    let v: FormatTestOptions = serde_json::from_str(&contents[..])?;
    Ok(v)
}

pub fn match_format_string_in_file(
    format_expr: &str,
    file_name: &str,
    max_lines: i64,
) -> Result<FormatStringMatches, failure::Error> {
    let regex = date_format_str_to_regex(format_expr)?;
    let path = PathBuf::from(file_name);
    let f: fs::File = fs::File::open(path)?;
    let mut reader: BufReader<&std::fs::File> = BufReader::new(&f);
    let mut buf = vec![];
    let mut inspected_lines = 0usize;
    let mut matched_lines = 0usize;
    let mut processed_bytes = 0;
    while let Ok(len) = reader.read_until(b'\n', &mut buf) {
        if len == 0 {
            break; // file is done
        }
        let s = unsafe { std::str::from_utf8_unchecked(&buf) };
        if !s.trim().is_empty() {
            inspected_lines += 1;
            if regex.is_match(s.trim()) {
                matched_lines += 1;
            }
            processed_bytes += s.trim().len();
        }
        buf = vec![];
        if inspected_lines > max_lines as usize {
            break;
        }
    }
    Ok(FormatStringMatches {
        regex: regex.to_string(),
        matching_lines: matched_lines,
        nonmatching_lines: inspected_lines - matched_lines,
        processed_bytes,
    })
}

pub fn line_matching_format_expression(
    format_expr: &str,
    line: &str,
) -> Result<bool, failure::Error> {
    let regex = date_format_str_to_regex(format_expr)?;
    Ok(regex.is_match(line))
}
// return the timestamp and wether the year was missing
pub fn to_posix_timestamp(
    line: &str,
    regex: &Regex,
    year: Option<i32>,
    time_offset: Option<i64>,
) -> Result<(i64, bool), failure::Error> {
    let caps = regex
        .captures(line)
        .ok_or_else(|| failure::err_msg("no captures in regex"))?;
    if caps.name(ABSOLUTE_MS_GROUP).is_some() && caps.len() == 1 + 1 {
        // only one matched group in addition to the full match
        let abs_ms_capt = caps.name(ABSOLUTE_MS_GROUP).expect("was verified");
        let absolute_ms: i64 = abs_ms_capt.as_str().parse()?;
        return Ok((absolute_ms - time_offset.unwrap_or(0), false));
    }
    let day_capt = caps
        .name(DAY_GROUP)
        .ok_or_else(|| failure::err_msg("no group for days found in regex"))?;
    let month_capt = caps
        .name(MONTH_GROUP)
        .ok_or_else(|| failure::err_msg("no group for month found in regex"))?;
    let (day, month): (u32, u32) = (day_capt.as_str().parse()?, month_capt.as_str().parse()?);
    let hour_capt = caps
        .name(HOUR_GROUP)
        .ok_or_else(|| failure::err_msg("no group for hour found in regex"))?;
    let min_capt = caps
        .name(MINUTE_GROUP)
        .ok_or_else(|| failure::err_msg("no group for minute found in regex"))?;
    let sec_capt = caps
        .name(SECONDS_GROUP)
        .ok_or_else(|| failure::err_msg("no group for seconds found in regex"))?;
    let mil_str = match caps.name(FRACTION_GROUP) {
        Some(m) => m.as_str(),
        None => "0",
    };
    let (hour, minutes, seconds, millis): (u32, u32, u32, u32) = (
        hour_capt.as_str().parse()?,
        min_capt.as_str().parse()?,
        sec_capt.as_str().parse()?,
        mil_str.parse()?,
    );

    let timezone_n = caps.name(TIMEZONE_GROUP);
    if time_offset.is_none() && timezone_n.is_none() {
        eprintln!("timestamp cannot be applied");
        return Err(failure::err_msg("timestamp cannot be applied"));
    }
    let offset_result = if time_offset.is_none() {
        parse_timezone(&caps[TIMEZONE_GROUP])
    } else {
        time_offset.ok_or_else(|| failure::err_msg("could not detect timestamp in"))
    };
    let the_year: Option<i32> = match caps.name(YEAR_GROUP) {
        Some(year_str) => year_str.as_str().parse().ok(),
        None => year,
    };
    match (the_year, offset_result) {
        (Some(y), Ok(offset)) => {
            let date_time: Option<NaiveDateTime> = NaiveDate::from_ymd_opt(y, month, day)
                .and_then(|d| d.and_hms_milli_opt(hour, minutes, seconds, millis));
            match date_time {
                Some(dt) => Ok((dt.timestamp_millis() - offset, false)),
                None => Err(failure::err_msg(
                    "error while parsing year/month/day/hour/minute/seconds",
                )),
            }
        }
        (None, Ok(offset)) => {
            let y = Utc::now().year();
            let date_time: Option<NaiveDateTime> = NaiveDate::from_ymd_opt(y, month, day)
                .and_then(|d| d.and_hms_milli_opt(hour, minutes, seconds, millis));
            match date_time {
                Some(dt) => Ok((dt.timestamp_millis() - offset, true)),
                None => Err(failure::err_msg(
                    "error while parsing year/month/day/hour/minute/seconds",
                )),
            }
        }
        (Some(_), Err(e)) => Err(failure::err_msg(format!(
            "could not determine the timezone or offset! ({})",
            e
        ))),
        (None, Err(_)) => Err(failure::err_msg(
            "could not determine the year and timezone or offset!",
        )),
    }
}
pub fn line_to_timed_line(
    line: &str,
    original_line_length: usize,
    tag: &str,
    regex: &Regex,
    year: Option<i32>,
    time_offset: Option<i64>,
) -> Result<TimedLine, failure::Error> {
    let (posix_timestamp, year_was_missing) = to_posix_timestamp(line, regex, year, time_offset)?;
    Ok(TimedLine {
        timestamp: posix_timestamp,
        content: line.to_string(),
        tag: tag.to_string(),
        original_length: original_line_length,
        year_was_missing,
    })
}

#[allow(dead_code)]
pub fn detect_timestamp_format(
    path: &Path,
    possible_formats: &[String],
) -> Result<String, failure::Error> {
    let f: fs::File = fs::File::open(path)?;
    let mut reader: BufReader<&std::fs::File> = BufReader::new(&f);

    let mut buf = vec![];
    let mut inspected_lines = 0;
    let mut matched_lines: HashMap<&String, usize> = HashMap::new();
    let formats_to_check: HashSet<&String> = possible_formats
        .iter()
        .filter(|s| date_format_str_to_regex(s).is_ok())
        .collect();

    for format_string in formats_to_check {
        matched_lines.insert(format_string, 0usize);
    }
    while let Ok(len) = reader.read_until(b'\n', &mut buf) {
        if len == 0 {
            break; // file is done
        }
        let s = unsafe { std::str::from_utf8_unchecked(&buf) };
        if !s.trim().is_empty() {
            for (format_to_check, _) in matched_lines.clone().iter() {
                if let Ok(did_match) = line_matching_format_expression(format_to_check.as_str(), s)
                {
                    if did_match {
                        *matched_lines.entry(format_to_check).or_insert(0) += 1;
                    }
                }
            }
            inspected_lines += 1;
        }
        buf = vec![];
        if inspected_lines > LINES_TO_INSPECT {
            break;
        }
    }
    let best_format_string =
        matched_lines.iter().fold(
            (None, 0usize),
            |acc, (&k, &v)| {
                if acc.1 < v {
                    (Some(k), v)
                } else {
                    acc
                }
            },
        );
    let min_matched_lines = std::cmp::min(LINE_DETECTION_THRESHOLD, inspected_lines);
    if let (Some(s), n) = best_format_string {
        if n >= min_matched_lines {
            return Ok(s.clone());
        }
    }

    eprintln!("could not detect timestamp in {:?}", path);
    Err(failure::err_msg(format!(
        "could not detect timestamp in {:?}",
        path
    )))
}

/// should parse timezone string, valid formats are
/// +hh:mm, +hhmm, or +hh
/// -hh:mm, -hhmm, or -hh
/// results in the offset in milliseconds
fn timezone_parser(input: &str) -> IResult<&str, i64> {
    let timezone_sign = map(nom::branch::alt((char('+'), char('-'))), |c| c == '+');
    fn timezone_count(input: &str) -> IResult<&str, i64> {
        let (rest, r) = nom::bytes::complete::take(2usize)(input)?;
        let second = map_res(digit1, |s: &str| s.parse::<i64>())(r)?;
        Ok((rest, second.1))
    }
    fn timezone_minutes(input: &str) -> IResult<&str, i64> {
        nom::sequence::preceded(opt(char(':')), timezone_count)(input)
    }
    let parser = nom::sequence::tuple((timezone_sign, timezone_count, opt(timezone_minutes)));
    map(parser, |(positiv, hour, min): (bool, i64, Option<i64>)| {
        let absolute = 1000 * (3600 * hour + 60 * min.unwrap_or(0));
        (if positiv { 1 } else { -1 }) * absolute
    })(input)
}
fn parse_timezone(input: &str) -> Result<i64, failure::Error> {
    match timezone_parser(input) {
        Ok((_, res)) => Ok(res),
        Err(e) => Err(failure::err_msg(format!("error parsing timezone: {:?}", e))),
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    use pretty_assertions::assert_eq;
    use proptest::prelude::*;

    static VALID_TIMESTAMP_FORMAT: &str = "[+-]{1}[0-9]{2}[0-5]{1}[0-9]{1}";

    proptest! {
        #[test]
        fn offset_from_timezone_in_ms_doesnt_crash(s in "\\PC*") {
            let _ = parse_timezone(&s);
        }
        #[test]
        fn parses_all_valid_dates(s in VALID_TIMESTAMP_FORMAT) {
            parse_timezone(&s).unwrap();
        }
    }

    #[test]
    fn test_date_parsers() {
        assert_eq!(any_date_format("DD23"), Ok(("23", FormatPiece::Day)));
        assert_eq!(
            any_date_format("sss23"),
            Ok(("23", FormatPiece::AbsoluteMilliseconds))
        );
        assert_eq!(any_date_format("MM23"), Ok(("23", FormatPiece::Month)));
        assert_eq!(any_date_format("DDMM"), Ok(("MM", FormatPiece::Day)));
        assert_eq!(any_date_format("YYYY-"), Ok(("-", FormatPiece::Year)));

        assert_eq!(
            any_date_format("-YYYY"),
            Ok(("YYYY", FormatPiece::SeperatorChar('-')))
        );
    }

    #[test]
    fn test_offset_from_timezone_in_ms_non_ascii() {
        assert!(parse_timezone("aࡠA").is_err());
    }
    #[test]
    fn test_offset_from_timezone_in_ms_invalid_input() {
        assert!(parse_timezone("0Aaa0").is_err());
    }

    #[test]
    fn test_timezone_parser() {
        if let Ok(res) = parse_timezone("+01:00") {
            println!("res: {:?}", res);
        } else {
            println!("could not parse");
        }
    }
    #[test]
    fn test_offset_from_timezone_in_ms() {
        assert_eq!(0, parse_timezone("+0000").expect("could not parse"));
        assert_eq!(0, parse_timezone("-0000").expect("could not parse"));
        assert_eq!(
            2 * 3600 * 1000,
            parse_timezone("+0200").expect("could not parse")
        );
        assert_eq!(
            2 * 3600 * 1000,
            parse_timezone("+02:00").expect("could not parse")
        );
        assert_eq!(
            2 * 3600 * 1000 + 30 * 60 * 1000,
            parse_timezone("+0230").expect("could not parse")
        );
        assert_eq!(
            -2 * 3600 * 1000,
            parse_timezone("-0200").expect("could not parse")
        );
    }
}
