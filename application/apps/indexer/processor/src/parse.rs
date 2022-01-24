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
use chrono::{DateTime, Datelike, NaiveDate, NaiveDateTime, Utc};
use crossbeam_channel as cc;
use indexer_base::{
    error_reporter::*,
    progress::{Severity, *},
    timedline::TimedLine,
};

use nom::{
    bytes::complete::{tag, take},
    character::complete::{char, digit1},
    combinator::{map, map_res, opt},
    multi::{fold_many0, many1},
    IResult,
};

use regex::Regex;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use std::{
    borrow::Cow,
    collections::{BTreeMap, HashSet},
    fs,
    io::{BufRead, BufReader, Read, Seek},
    path::{Path, PathBuf},
};

const MAX_LINES_TO_INSPECT: usize = 100_000;
const LINE_DETECTION_THRESHOLD: usize = 5;

#[derive(Debug, Error)]
pub enum DateParseError {
    #[error("Cannot create regex for {0}")]
    Regex(String),
    #[error("Concatenation not possible: {0:?}")]
    IoProblem(#[from] std::io::Error),
    #[error("Wrong format")]
    FormatExpression,
    #[error("Not enough information to determine timestamp format")]
    TimestampFormatUnclear,
    #[error("Unknown timestamp format")]
    UnknownTimestampFormat,
    #[error("Unknown timezone")]
    UnknownTimezone,
    #[error("Problem parsing: ()")]
    InvalidParse(String),
    #[error("Format configuration cannot be read: {0:?}")]
    FormatConfiguration(#[from] serde_json::Error),
}

/// add a format string in normal form and with TZD for a possible timezone match
macro_rules! add_twice {
    ($var:expr, $a:expr, $m:expr) => {
        $a.push(concat!($var, " TZD"));
        $a.push($var);
        $m.insert(
            concat!($var, " TZD"),
            date_format_str_to_regex(concat!($var, " TZD")).expect("static regex failed"),
        );
        $m.insert(
            $var,
            date_format_str_to_regex($var).expect("static regex failed"),
        );
    };
}

lazy_static! {
    static ref FORMAT_REGEX_MAPPINGS: (Vec<&'static str>, BTreeMap<&'static str, Regex>) = {
        let mut arr = Vec::new();
        let mut v = BTreeMap::default();
        add_twice!("YYYY-MM-DD hh:mm:ss.s", &mut arr, &mut v);
        add_twice!("YYYY-MM-DDThh:mm:ss.s", &mut arr, &mut v);
        add_twice!("YYYY-MM-DDThh:mm:ss", &mut arr, &mut v);
        add_twice!("YYYY MM DD hh:mm:ss.s", &mut arr, &mut v);
        add_twice!("YYYY MM DDThh:mm:ss.s", &mut arr, &mut v);
        add_twice!("YYYY MM DD hh:mm:ss", &mut arr, &mut v);
        add_twice!("YYYY MM DDThh:mm:ss", &mut arr, &mut v);
        add_twice!("MM-DDThh:mm:ss.s", &mut arr, &mut v);
        add_twice!("MM-DD hh:mm:ss.s", &mut arr, &mut v);
        add_twice!("MM-DD-YYYYThh:mm:ss.s", &mut arr, &mut v);
        add_twice!("MM-DD-YYYY hh:mm:ss.s", &mut arr, &mut v);
        add_twice!("MM/DD/YYYY hh:mm:ss a", &mut arr, &mut v);
        add_twice!("MM/DD/yy hh:mm:ss", &mut arr, &mut v);
        add_twice!("DD/MMM/YYYY:hh:mm:ss", &mut arr, &mut v);
        add_twice!("DD/MMM/YYYY hh:mm:ss", &mut arr, &mut v);
        add_twice!("DD-MMM-YYYY hh:mm:ss", &mut arr, &mut v);
        add_twice!("DD/MMM/YYYYThh:mm:ss", &mut arr, &mut v);
        add_twice!("DD MMM YYYY hh:mm:ss", &mut arr, &mut v);
        (arr, v)
    };
    static ref AVAILABLE_FORMATS: Vec<&'static str> = FORMAT_REGEX_MAPPINGS.0.clone();
    static ref FORMAT_REGEX_MAPPING: BTreeMap<&'static str, Regex> =
        FORMAT_REGEX_MAPPINGS.1.clone();
}

pub fn posix_timestamp_as_string(timestamp_ms: i64) -> String {
    match NaiveDateTime::from_timestamp_opt(
        (timestamp_ms as f64 / 1000.0) as i64,
        (timestamp_ms as f64 % 1000.0) as u32 * 1000,
    ) {
        Some(naive_datetime_max) => {
            let t: DateTime<Utc> = DateTime::from_utc(naive_datetime_max, Utc);
            format!("{}", t)
        }
        None => format!("could not parse: {}", timestamp_ms),
    }
}
#[derive(Debug, PartialEq, Eq, Hash, Clone)]
pub enum FormatPiece {
    Day,
    Month,
    MonthName,
    Year,
    YearShort,
    Hour,
    Minute,
    Second,
    Fraction,
    TimeZone,
    AmPm,
    AbsoluteMilliseconds,
    SeperatorChar(char),
    Seperator(String),
}
impl std::fmt::Display for FormatPiece {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            FormatPiece::Day => write!(f, "Day"),
            FormatPiece::Month => write!(f, "Month"),
            FormatPiece::MonthName => write!(f, "MonthName"),
            FormatPiece::Year => write!(f, "Year"),
            FormatPiece::YearShort => write!(f, "YearShort"),
            FormatPiece::Hour => write!(f, "Hour"),
            FormatPiece::Minute => write!(f, "Minute"),
            FormatPiece::Second => write!(f, "Second"),
            FormatPiece::Fraction => write!(f, "Fraction"),
            FormatPiece::AmPm => write!(f, "AmPm"),
            FormatPiece::TimeZone => write!(f, "TimeZone"),
            FormatPiece::AbsoluteMilliseconds => write!(f, "AbsoluteMilliseconds"),
            FormatPiece::SeperatorChar(_) => write!(f, "SeperatorChar"),
            FormatPiece::Seperator(_) => write!(f, "Seperator"),
        }
    }
}

static DAY_FORMAT_TAG: &str = "DD";
static MONTH_FORMAT_SHORT_NAME_TAG: &str = "MMM";
static MONTH_FORMAT_TAG: &str = "MM";
static YEAR_FORMAT_TAG: &str = "YYYY";
static YEAR_SHORT_FORMAT_TAG: &str = "yy";
static HOURS_FORMAT_TAG: &str = "hh";
static MINUTES_FORMAT_TAG: &str = "mm";
static SECONDS_FORMAT_TAG: &str = "ss";
static TIMEZONE_FORMAT_TAG: &str = "TZD";
static ABSOLUTE_MS_TAG: &str = "sss";
const FRACTION_FORMAT_CHAR: char = 's';
const AM_PM_TAG: char = 'a';

fn days(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(DAY_FORMAT_TAG), |_| FormatPiece::Day)(input)
}
fn month_short(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(MONTH_FORMAT_SHORT_NAME_TAG), |_| FormatPiece::MonthName)(input)
}
fn month(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(MONTH_FORMAT_TAG), |_| FormatPiece::Month)(input)
}
fn year(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(YEAR_FORMAT_TAG), |_| FormatPiece::Year)(input)
}
fn year_short(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(YEAR_SHORT_FORMAT_TAG), |_| FormatPiece::YearShort)(input)
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
fn am_pm(input: &str) -> IResult<&str, FormatPiece> {
    map(nom::character::complete::char(AM_PM_TAG), |_| {
        FormatPiece::AmPm
    })(input)
}
fn timezone(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(TIMEZONE_FORMAT_TAG), |_| FormatPiece::TimeZone)(input)
}
fn absolute_millis(input: &str) -> IResult<&str, FormatPiece> {
    map(tag(ABSOLUTE_MS_TAG), |_| FormatPiece::AbsoluteMilliseconds)(input)
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
pub(crate) fn any_date_format(input: &str) -> IResult<&str, FormatPiece> {
    nom::branch::alt((
        days,
        month_short,
        month,
        year,
        year_short,
        hours,
        minutes,
        absolute_millis,
        seconds,
        fraction,
        am_pm,
        timezone,
        seperator,
    ))(input)
}
fn escape_metacharacters(c: char) -> Cow<'static, str> {
    match c {
        ' ' => r"\s?",
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
    }
    .into()
}

/// takes a format string for a date representation and tokenize it
/// into it's individual elements
/// e.g. "DD-MM" => [Day,Seperator("-"),Month]
///      YYYY = four-digit year
///      yy   = two-digit year
///      MMM  = short month form (Jan, Feb, Mar, ..., Dec)
///      MM   = two-digit month (01=January, etc.)
///      DD   = two-digit day of month (01 through 31)
///      hh   = two digits of hour (00 through 23) (am/pm NOT allowed)
///      mm   = two digits of minute (00 through 59)
///      ss   = two digits of second (00 through 59)
///      s    = one or more digits representing a decimal fraction of a second
///      TZD  = time zone designator (Z or +hh:mm or -hh:mm)
///      a    = support for 12-hour clock format (AM or PM)
pub(crate) fn date_expression(input: &str) -> IResult<&str, Vec<FormatPiece>> {
    let parser = fold_many0(
        any_date_format,
        || (String::from(""), Vec::new()),
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

pub fn lookup_regex_for_format_str(date_format: &str) -> Result<Regex, DateParseError> {
    match FORMAT_REGEX_MAPPING.get(date_format) {
        Some(r) => Ok(r.clone()),
        None => date_format_str_to_regex(date_format),
    }
}

fn date_format_str_to_regex(date_format: &str) -> Result<Regex, DateParseError> {
    if date_format.is_empty() {
        return Err(DateParseError::Regex("empty string".to_owned()));
    }
    let format_pieces = date_expression(date_format);
    match format_pieces {
        Ok(r) => {
            if r.1.is_empty() {
                return Err(DateParseError::Regex(date_format.to_owned()));
            }
            let s = r.1.iter().fold(String::from(r""), |mut acc, x| {
                let part = format_piece_as_regex_string(x);
                acc.push_str(part.as_str());
                acc
            });

            match Regex::new(s.as_str()) {
                Ok(regex) => Ok(regex),
                Err(_) => Err(DateParseError::Regex(s.to_owned())),
            }
        }
        Err(e) => {
            report_error(format!("{:?}", e));
            Err(DateParseError::FormatExpression)
        }
    }
}
static DAY_GROUP: &str = "d";
static MONTH_GROUP: &str = "m";
static MONTH_SHORT_NAME_GROUP: &str = "MMM";
static YEAR_GROUP: &str = "Y";
static YEAR_SHORT_GROUP: &str = "y";
static HOUR_GROUP: &str = "H";
static MINUTE_GROUP: &str = "M";
static SECONDS_GROUP: &str = "S";
static FRACTION_GROUP: &str = "millis";
static AM_PM_GROUP: &str = "am_pm";
static TIMEZONE_GROUP: &str = "timezone";
static ABSOLUTE_MS_GROUP: &str = "absolute";

fn named_group(regex: &str, capture_id: &str) -> String {
    format!(r"(?P<{}>{})", capture_id, regex)
}

fn format_piece_as_regex_string(p: &FormatPiece) -> String {
    match p {
        FormatPiece::Day => named_group(r"([0-2]\d|3[01])", DAY_GROUP),
        FormatPiece::Month => named_group(r"(0?\d|1[0-2])", MONTH_GROUP),
        FormatPiece::MonthName => named_group(
            r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)",
            MONTH_SHORT_NAME_GROUP,
        ),
        FormatPiece::Year => named_group(r"[0-2]\d{3}", YEAR_GROUP),
        FormatPiece::YearShort => named_group(r"\d{2}", YEAR_SHORT_GROUP),
        FormatPiece::Hour => named_group(r"(0?\d|1\d|2[0-3])", HOUR_GROUP),
        FormatPiece::Minute => named_group(r"[0-5]\d", MINUTE_GROUP),
        FormatPiece::Second => named_group(r"[0-5]\d", SECONDS_GROUP),
        FormatPiece::Fraction => named_group(r"\d+", FRACTION_GROUP),
        FormatPiece::AmPm => named_group(r"(AM|PM)", AM_PM_GROUP),
        FormatPiece::TimeZone => named_group(r"[\+\-](0\d|1[0-4]):?(00|30|45)", TIMEZONE_GROUP),
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
#[derive(Clone)]
pub struct DateTimeReplacements {
    pub year: Option<i32>,
    pub month: Option<u32>,
    pub day: Option<u32>,
    pub offset: Option<i64>,
}
pub fn read_format_string_options(f: &mut fs::File) -> Result<FormatTestOptions, DateParseError> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)?;
    let v: FormatTestOptions = serde_json::from_str(&contents)?;
    Ok(v)
}

/// try to find out the maximum and the minimum timestamp of log entries in a text file
///
/// # Arguments
///
/// * `regex` - the regex for the timestamp
/// * `limit` - if set, do not inspect more then this many lines
/// * `start` - offset in bytes where to start the file inspection
///
/// # Returns (scanned_cnt, min_timestamp, max_timestamp)
///
/// * `scanned_cnt` - amount of lines we scanned
/// * `min_timestamp` - value for the min value
/// * `max_timestamp` - value for the max value
///
pub(crate) fn scan_lines(
    f: &std::fs::File,
    regex: &Regex,
    limit: Option<usize>,
    start: Option<u64>,
    year: Option<i32>,
) -> Result<(usize, Option<i64>, Option<i64>), DateParseError> {
    let mut buf = vec![];

    let mut reader: BufReader<&std::fs::File> = BufReader::new(f);
    let mut scanned_cnt = 0usize;
    let mut min_timestamp: Option<i64> = None;
    let mut max_timestamp: Option<i64> = None;

    if let Some(n) = start {
        reader.seek(std::io::SeekFrom::Start(n))?;
    }
    let mut inspected_lines = 0usize;
    loop {
        let len = reader.read_until(b'\n', &mut buf)?;
        if len == 0 {
            break; // file is done
        }
        let line = String::from_utf8_lossy(&buf);
        scanned_cnt += 1;
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            inspected_lines += 1;
            let replacements: DateTimeReplacements = DateTimeReplacements {
                day: None,
                month: None,
                year,
                offset: Some(0),
            };
            match extract_posix_timestamp(trimmed, regex, replacements) {
                // TODO work on fast parsers to replace regex parsing
                // match parse_full_timestamp(trimmed, &regex) {
                Ok((timestamp, _)) => {
                    min_timestamp = match min_timestamp {
                        Some(min) => Some(std::cmp::min(min, timestamp)),
                        None => Some(timestamp),
                    };
                    max_timestamp = match max_timestamp {
                        Some(max) => Some(std::cmp::max(max, timestamp)),
                        None => Some(timestamp),
                    };
                }
                Err(e) => debug!("error extracting timestamp: {}", e),
            }
        }
        buf = vec![];
        if let Some(limit) = limit {
            if inspected_lines > limit {
                break;
            }
        }
    }
    Ok((scanned_cnt, min_timestamp, max_timestamp))
}

pub fn unix_timestamp_to_utc(timestamp: i64) -> DateTime<Utc> {
    let naive_datetime = NaiveDateTime::from_timestamp(timestamp, 0);
    DateTime::from_utc(naive_datetime, Utc)
}

/// find out the lower and upper timestamp of a file
pub(crate) fn timespan_in_file(
    format_expr: &str,
    file_path: impl AsRef<Path>,
    year: Option<i32>,
) -> Result<TimestampFormatResult, DateParseError> {
    trace!("timespan_in_file for \"{}\"", format_expr);
    let regex = lookup_regex_for_format_str(format_expr)?;
    trace!("regex for \"{}\" => {}", format_expr, regex.as_str());
    let f: fs::File = fs::File::open(&file_path)?;
    let file_size = f.metadata()?.len();
    let min_buf_size = std::cmp::min(file_size, 256 * 1024); // 256k
    let lines_to_scan = 1000usize;
    let (_line_cnt, min_timestamp, max_timestamp) =
        scan_lines(&f, &regex, Some(lines_to_scan), None, year)?;
    // also read from end
    let start = file_size - min_buf_size;
    let (_last_scanned_lines, min_timestamp_last, max_timestamp_last) =
        scan_lines(&f, &regex, None, Some(start), year)?;
    let timestamp_format = TimestampFormat {
        format: format_expr.to_string(),
        regex: regex_as_string(&regex),
        flags: vec![],
    };
    let min_time = match (min_timestamp, min_timestamp_last) {
        (Some(t1), Some(t2)) => Some(std::cmp::min(t1, t2)),
        _ => None,
    };
    let max_time = match (max_timestamp, max_timestamp_last) {
        (Some(t1), Some(t2)) => Some(std::cmp::max(t1, t2)),
        _ => None,
    };
    match (min_time, max_time) {
        (None, None) => Ok(TimestampFormatResult {
            path: format!("{}", file_path.as_ref().display()),
            format: Err(format!("{} did not match in file", format_expr)),
            min_time: None,
            max_time: None,
        }), // format string did not produce results
        (min, max) => Ok(TimestampFormatResult {
            path: format!("{}", file_path.as_ref().display()),
            format: Ok(timestamp_format),
            min_time: min,
            max_time: max,
        }),
    }
}

pub fn timespan_in_files(
    items: Vec<DiscoverItem>,
    update_channel: &cc::Sender<IndexingResults<TimestampFormatResult>>,
) -> Result<(), DateParseError> {
    let item_count = items.len();
    let mut progress_reporter = ProgressReporter::new(item_count as u64, update_channel.clone());
    for item in items.into_iter() {
        let file_path = PathBuf::from(&item.path);
        let format_expr_to_use = match item.format_string {
            Some(test_expr) => Ok(test_expr),
            None => detect_timestamp_format_in_file(&file_path),
        };

        match format_expr_to_use {
            Ok(format_expr) => {
                match timespan_in_file(&format_expr, &file_path, item.fallback_year) {
                    Ok(timestamp_format_result) => {
                        update_channel
                            .send(Ok(IndexingProgress::GotItem {
                                item: timestamp_format_result,
                            }))
                            .expect("UpdateChannel closed");
                    }
                    Err(e) => {
                        update_channel
                            .send(Err(Notification {
                                severity: Severity::WARNING,
                                content: format!("{}", e),
                                line: None,
                            }))
                            .expect("UpdateChannel closed");
                    }
                }
            }
            Err(e) => {
                update_channel
                    .send(Ok(IndexingProgress::GotItem {
                        item: TimestampFormatResult {
                            path: item.path.to_string(),
                            format: Err(format!("error trying to detect format expression: {}", e)),
                            min_time: None,
                            max_time: None,
                        },
                    }))
                    .expect("UpdateChannel closed");
                update_channel
                    .send(Err(Notification {
                        severity: Severity::WARNING,
                        content: format!("executed with error: {}", e),
                        line: None,
                    }))
                    .expect("UpdateChannel closed");
            }
        }
        progress_reporter.make_progress(1);
    }
    update_channel
        .send(Ok(IndexingProgress::Finished))
        .expect("Could not use update channel");
    Ok(())
}
/// find out how often a format string matches a timestamp in a file
pub fn match_format_string_in_file(
    format_expr: &str,
    file_name: &str,
    max_lines: i64,
) -> Result<FormatStringMatches, DateParseError> {
    let regex = lookup_regex_for_format_str(format_expr)?;
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

/// check a new format expression that was not precompiled
pub fn line_matching_format_expression(
    format_expr: &str,
    line: &str,
) -> Result<bool, DateParseError> {
    let regex = lookup_regex_for_format_str(format_expr)?;
    let res = regex.is_match(line);
    Ok(res)
}
fn parse_from_month(mmm: &str) -> Result<u32, DateParseError> {
    match mmm {
        "Jan" => Ok(1),
        "Feb" => Ok(2),
        "Mar" => Ok(3),
        "Apr" => Ok(4),
        "May" => Ok(5),
        "Jun" => Ok(6),
        "Jul" => Ok(7),
        "Aug" => Ok(8),
        "Sep" => Ok(9),
        "Oct" => Ok(10),
        "Nov" => Ok(11),
        "Dec" => Ok(12),
        _ => Err(DateParseError::InvalidParse(format!(
            "could not parse month {:?}",
            mmm
        ))),
    }
}

#[derive(Serialize, Debug, PartialEq)]
pub enum FormatCheckResult {
    FormatRegex(String),
    FormatInvalid(String),
}

#[derive(Clone, Debug)]
pub struct FormatCheckFlags {
    pub miss_year: bool,
    pub miss_month: bool,
    pub miss_day: bool,
}

pub fn check_format(format: &str, flags: FormatCheckFlags) -> FormatCheckResult {
    match lookup_regex_for_format_str(format) {
        Err(e) => FormatCheckResult::FormatInvalid(format!("format invalid: {}", e)),
        Ok(regex) => {
            let mut s = HashSet::new();
            for n in regex.capture_names().flatten() {
                s.insert(n);
            }
            if !s.contains(ABSOLUTE_MS_TAG) {
                if !flags.miss_year && !s.contains(YEAR_GROUP) && !s.contains(YEAR_SHORT_GROUP) {
                    return FormatCheckResult::FormatInvalid(format!(
                        "missing long or short year ({} or {})",
                        YEAR_FORMAT_TAG, YEAR_SHORT_FORMAT_TAG,
                    ));
                }
                if !flags.miss_month
                    && !s.contains(MONTH_GROUP)
                    && !s.contains(MONTH_SHORT_NAME_GROUP)
                {
                    return FormatCheckResult::FormatInvalid(format!(
                        "missing numeric or short month ({} or {})",
                        MONTH_FORMAT_TAG, MONTH_FORMAT_SHORT_NAME_TAG,
                    ));
                }
                if !flags.miss_day && !s.contains(DAY_GROUP) {
                    return FormatCheckResult::FormatInvalid(format!(
                        "missing days ({})",
                        DAY_FORMAT_TAG
                    ));
                }
                if !s.contains(HOUR_GROUP) {
                    return FormatCheckResult::FormatInvalid(format!(
                        "missing hours ({})",
                        HOURS_FORMAT_TAG
                    ));
                }
                if !s.contains(MINUTE_GROUP) {
                    return FormatCheckResult::FormatInvalid(format!(
                        "missing minutes ({})",
                        MINUTES_FORMAT_TAG
                    ));
                }
            }
            FormatCheckResult::FormatRegex(regex.as_str().to_string())
        }
    }
}

/// return the timestamp and wether the year was missing
pub fn extract_posix_timestamp(
    line: &str,
    regex: &Regex,
    replacements: DateTimeReplacements,
) -> Result<(i64, bool), DateParseError> {
    let caps = regex
        .captures(line)
        .ok_or_else(|| DateParseError::InvalidParse("No captures in regex".to_owned()))?;
    /* only one matched group in addition to the full match */
    if caps.len() == 1 + 1 {
        if let Some(abs_ms_capt) = caps.name(ABSOLUTE_MS_GROUP) {
            let absolute_ms: i64 = abs_ms_capt.as_str().parse().map_err(|_| {
                DateParseError::InvalidParse("Could not parse ms as a number".to_owned())
            })?;
            return Ok((absolute_ms - replacements.offset.unwrap_or(0), false));
        }
    }
    let day: u32 = match caps.name(DAY_GROUP) {
        Some(day_str) => day_str
            .as_str()
            .parse()
            .map_err(|e| DateParseError::InvalidParse(format!("fail parse day: {}", e))),
        None => replacements.day.ok_or_else(|| {
            DateParseError::InvalidParse("no group for days found in regex".to_owned())
        }),
    }?;
    let month = match caps.name(MONTH_GROUP) {
        Some(month_capt) => month_capt
            .as_str()
            .parse()
            .map_err(|e| DateParseError::InvalidParse(format!("could not parse month: {}", e))),
        None => match caps.name(MONTH_SHORT_NAME_GROUP) {
            Some(month_short_name) => parse_from_month(month_short_name.as_str()),
            None => replacements.month.ok_or_else(|| {
                DateParseError::InvalidParse("no group for month found in regex".to_owned())
            }),
        },
    }?;
    let hour_capt = caps.name(HOUR_GROUP).ok_or_else(|| {
        DateParseError::InvalidParse("no group for hour found in regex".to_owned())
    })?;
    let min_capt = caps.name(MINUTE_GROUP).ok_or_else(|| {
        DateParseError::InvalidParse("no group for minute found in regex".to_owned())
    })?;
    // let sec_capt: u32 = caps.name(SECONDS_GROUP).unwrap().as_str().parse()?;
    let seconds: u32 = match caps.name(SECONDS_GROUP) {
        None => {
            warn!("no group for seconds found in regex, assuming 0");
            0u32
        }
        Some(m) => m.as_str().parse().map_err(|_| {
            DateParseError::InvalidParse("Could not parse seconds as a number".to_owned())
        })?,
    };
    let am_pm_hour_offset: u32 = match caps.name(AM_PM_GROUP) {
        Some(m) => match m.as_str() {
            "PM" => Ok(12),
            "AM" => Ok(0),
            _ => Err(DateParseError::InvalidParse(
                "no valid AM or PM designation".to_owned(),
            )),
        },
        None => Ok(0),
    }?;
    let (hour, minutes, second_fractions): (u32, u32, u32) = (
        hour_capt
            .as_str()
            .parse()
            .map_err(|_| {
                DateParseError::InvalidParse("Could not parse hours as a number".to_owned())
            })
            .map(|h: u32| h + am_pm_hour_offset)?,
        min_capt.as_str().parse().map_err(|_| {
            DateParseError::InvalidParse("Could not parse minutes as a number".to_owned())
        })?,
        match caps.name(FRACTION_GROUP) {
            Some(m) => {
                let s = m.as_str();
                let cut = &s[..std::cmp::min(3, s.len())];
                cut.parse().map_err(|_| {
                    DateParseError::InvalidParse(
                        "Could not parse second-fractions as a number".to_owned(),
                    )
                })?
            }
            None => 0,
        },
    );
    let millis = second_fractions;

    let timezone_n = caps.name(TIMEZONE_GROUP);
    if replacements.offset.is_none() && timezone_n.is_none() {
        return Err(DateParseError::UnknownTimezone);
    }
    let offset_result = if replacements.offset.is_none() {
        parse_timezone(&caps[TIMEZONE_GROUP])
    } else {
        replacements.offset.ok_or_else(|| {
            DateParseError::InvalidParse("could not detect timestamp in (line {})".to_owned())
        })
    };

    // for the year first try YYYY, then yy, then fallback on the supplied year
    // if even this is not here, use the current year
    let the_year: Option<i32> = match caps.name(YEAR_GROUP) {
        Some(year_str) => year_str.as_str().parse().ok(),
        None => match caps.name(YEAR_SHORT_GROUP) {
            Some(year_short_str) => year_short_str
                .as_str()
                .parse()
                .map(|ys: i32| ys + 2000i32)
                .ok(),
            None => replacements.year.or_else(|| Some(Utc::now().year())),
        },
    };

    match (the_year, offset_result) {
        (Some(y), Ok(offset)) => {
            let date_time: Option<NaiveDateTime> = NaiveDate::from_ymd_opt(y, month, day)
                .and_then(|d| d.and_hms_milli_opt(hour, minutes, seconds, millis));
            match date_time {
                Some(dt) => Ok((dt.timestamp_millis() - offset, false)),
                None => Err(DateParseError::InvalidParse(
                    "error while parsing year/month/day/hour/minute/seconds".to_owned(),
                )),
            }
        }
        (None, Ok(offset)) => {
            let y = Utc::now().year();
            let date_time: Option<NaiveDateTime> = NaiveDate::from_ymd_opt(y, month, day)
                .and_then(|d| d.and_hms_milli_opt(hour, minutes, seconds, millis));
            match date_time {
                Some(dt) => Ok((dt.timestamp_millis() - offset, true)),
                None => Err(DateParseError::InvalidParse(
                    "error while parsing year/month/day/hour/minute/seconds".to_owned(),
                )),
            }
        }
        (Some(_), Err(_)) => Err(DateParseError::UnknownTimezone),
        (None, Err(_)) => Err(DateParseError::InvalidParse(
            "could not determine the year and timezone or offset!".to_owned(),
        )),
    }
}

#[derive(Serialize, Debug, PartialEq)]
pub enum TimestampByFormatResult {
    Timestamp(i64),
    Error(String),
}
/// return the timestamp and wether the year was missing using format string only
pub fn extract_posix_timestamp_by_format(
    line: &str,
    format_expr: &str,
    replacements: DateTimeReplacements,
) -> TimestampByFormatResult {
    match lookup_regex_for_format_str(format_expr) {
        Err(e) => TimestampByFormatResult::Error(e.to_string()),
        Ok(regex) => match extract_posix_timestamp(line, &regex, replacements) {
            Err(e) => TimestampByFormatResult::Error(e.to_string()),
            Ok((tm, _res)) => TimestampByFormatResult::Timestamp(tm),
        },
    }
}

#[allow(clippy::too_many_arguments)]
pub fn line_to_timed_line(
    line: &str,
    original_line_length: usize,
    tag: &str,
    regex: &Regex,
    year: Option<i32>,
    time_offset: Option<i64>,
    line_nr: usize,
    reporter: &mut Reporter,
) -> Result<TimedLine, DateParseError> {
    let replacements: DateTimeReplacements = DateTimeReplacements {
        day: None,
        month: None,
        year,
        offset: time_offset,
    };
    match extract_posix_timestamp(line, regex, replacements) {
        Ok((posix_timestamp, year_was_missing)) => Ok(TimedLine {
            timestamp: posix_timestamp,
            content: line.to_string(),
            tag: tag.to_string(),
            original_length: original_line_length,
            year_was_missing,
            line_nr,
        }),
        Err(e) => {
            reporter.add_to_report(
                Severity::WARNING,
                format!("could not extract timestamp: {}", e),
            );
            Err(e)
        }
    }
}
#[derive(Deserialize, Debug)]
pub struct DiscoverItem {
    pub path: String,
    pub format_string: Option<String>,
    pub fallback_year: Option<i32>,
}
#[derive(Serialize, Debug)]
pub struct TimestampFormatResult {
    pub path: String,
    pub format: Result<TimestampFormat, String>,
    pub min_time: Option<i64>,
    pub max_time: Option<i64>,
}
#[derive(Serialize, Debug)]
pub struct TimestampFormat {
    format: String,
    regex: String,
    flags: Vec<String>,
}
pub fn detect_timestamp_format_in_file(path: &Path) -> Result<String, DateParseError> {
    use std::time::Instant;
    let now = Instant::now();
    let f: fs::File = fs::File::open(path)?;
    let mut reader: BufReader<&std::fs::File> = BufReader::new(&f);

    let mut buf = vec![];
    let mut inspected_lines = 0;
    let mut matched_format: BTreeMap<String, usize> = BTreeMap::default();
    let mut last_match: Option<String> = None;

    while let Ok(len) = reader.read_until(b'\n', &mut buf) {
        if len == 0 {
            break; // file is done
        }
        let s = unsafe { std::str::from_utf8_unchecked(&buf) }.trim();
        if !s.is_empty() {
            if let Ok(format) = detect_timeformat_in_string(s, last_match.as_ref()) {
                last_match = Some(format.clone());
                *matched_format.entry(format).or_insert(0) += 1;
            }
            inspected_lines += 1;
        }
        buf = vec![];
        if inspected_lines > MAX_LINES_TO_INSPECT {
            break;
        }
    }
    let best_format_string =
        matched_format.into_iter().fold(
            (None, 0usize),
            |acc, (k, v)| {
                if acc.1 < v {
                    (Some(k), v)
                } else {
                    acc
                }
            },
        );
    let min_matched_lines = std::cmp::min(LINE_DETECTION_THRESHOLD, inspected_lines);
    info!(
        "inspecting {} lines in {} took {}ms",
        inspected_lines,
        path.display(),
        now.elapsed().as_millis()
    );
    if let (Some(s), n) = best_format_string {
        if n >= min_matched_lines {
            return Ok(s);
        } else {
            return Err(DateParseError::TimestampFormatUnclear);
        }
    }

    Err(DateParseError::TimestampFormatUnclear)
}
/// Trys to detect a valid timestamp in a string
/// Returns the a tuple of
/// * the timestamp as posix timestamp
/// * if the year was missing
///   (we assume the current year (local time) if true)
/// * the format string that was used
///
/// # Arguments
///
/// * `input` - A string slice that should be parsed
pub fn detect_timestamp_in_string(
    input: &str,
    offset: Option<i64>,
) -> Result<(i64, bool, String), DateParseError> {
    let trimmed = input.trim();
    for format in AVAILABLE_FORMATS.iter() {
        let regex = &FORMAT_REGEX_MAPPING[format];
        if regex.is_match(trimmed) {
            let replacements: DateTimeReplacements = DateTimeReplacements {
                day: None,
                month: None,
                year: None,
                offset,
            };
            match extract_posix_timestamp(trimmed, regex, replacements) {
                Ok((timestamp, year_missing)) => {
                    return Ok((timestamp, year_missing, (*format).to_string()))
                }
                Err(e) => debug!("error trying to extract timestamp: {}", e),
            }
        }
    }
    Err(DateParseError::UnknownTimestampFormat)
}
/// Trys to detect a valid time-format in a string
/// Returns the found format if any
///
/// # Arguments
///
/// * `input` - A string slice that should be examined
pub fn detect_timeformat_in_string(
    input: &str,
    last_match: Option<&String>,
) -> Result<String, DateParseError> {
    let trimmed = input.trim();
    // if we already had a match, try this first
    if let Some(last) = last_match {
        let l: &str = last.as_ref();
        if let Some(regex) = FORMAT_REGEX_MAPPING.get(l) {
            if regex.is_match(trimmed) {
                return Ok(last.clone());
            }
        }
    }
    for format in AVAILABLE_FORMATS.iter() {
        let regex = &FORMAT_REGEX_MAPPING[format];
        if regex.is_match(trimmed) {
            return Ok((*format).to_string());
        }
    }
    Err(DateParseError::UnknownTimestampFormat)
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
fn two_digits(input: &str) -> IResult<&str, u32> {
    map_res(take2, |s: &str| s.parse())(input)
}
fn four_digits(input: &str) -> IResult<&str, u32> {
    map_res(take4, |s: &str| s.parse())(input)
}

fn parse_short_month(input: &str) -> IResult<&str, u32> {
    map_res(take(3usize), |s: &str| match s {
        "Jan" => Ok(1),
        "Feb" => Ok(2),
        "Mar" => Ok(3),
        "Apr" => Ok(4),
        "May" => Ok(5),
        "Jun" => Ok(6),
        "Jul" => Ok(7),
        "Aug" => Ok(8),
        "Sep" => Ok(9),
        "Oct" => Ok(10),
        "Nov" => Ok(11),
        "Dec" => Ok(12),
        _ => Err(DateParseError::InvalidParse(format!(
            "could not parse month {:?}",
            s
        ))),
    })(input)
}
fn take1(s: &str) -> IResult<&str, &str> {
    take(1usize)(s)
}
fn take2(s: &str) -> IResult<&str, &str> {
    take(2usize)(s)
}
fn take4(s: &str) -> IResult<&str, &str> {
    take(4usize)(s)
}
// 46.72.213.133 - - [12/Dec/2015:18:39:27 +0100]
// DD/MMM/YYYY:hh:mm:ss
pub fn parse_full_timestamp(input: &str, regex: &Regex) -> Result<(i64, bool), DateParseError> {
    match regex.find(input) {
        Some(mat) => {
            let parser = nom::sequence::tuple((
                two_digits,
                take1,
                parse_short_month,
                take1,
                four_digits,
                take1,
                two_digits,
                take1,
                two_digits,
                take1,
                two_digits,
                take1,
                timezone_parser,
            ));
            let mut mapped = map(parser, |r| (r.0, r.2, r.4, r.6, r.8, r.10, r.12));
            match mapped(mat.as_str()) {
                Ok((_, (day, month, year, hour, minutes, seconds, offset))) => {
                    let date_time: Option<NaiveDateTime> =
                        NaiveDate::from_ymd_opt(year as i32, month, day)
                            .and_then(|d| d.and_hms_milli_opt(hour, minutes, seconds, 0));
                    match date_time {
                        Some(dt) => Ok((dt.timestamp_millis() - offset, false)),
                        None => Err(DateParseError::InvalidParse(
                            "error while parsing year/month/day/hour/minute/seconds".to_owned(),
                        )),
                    }
                }
                Err(e) => Err(DateParseError::InvalidParse(format!(
                    "error while parsing: {:?}",
                    e
                ))),
            }
        }
        None => Err(DateParseError::InvalidParse(format!(
            "no timestamp found using regex {}",
            regex.as_str()
        ))),
    }
}

pub(crate) fn parse_timezone(input: &str) -> Result<i64, DateParseError> {
    match timezone_parser(input) {
        Ok((_, res)) => Ok(res),
        Err(e) => Err(DateParseError::InvalidParse(format!(
            "error parsing timezone: {:?}",
            e
        ))),
    }
}
fn regex_as_string(regex: &Regex) -> String {
    let res = regex.as_str().to_string();
    trace!("regex {} as_string = {}", regex.as_str(), res);
    res
}
