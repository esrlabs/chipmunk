use crate::timedline::*;
use chrono::{NaiveDate, NaiveDateTime};
use lazy_static::lazy_static;
use nom::bytes::complete::{tag, take_while_m_n};

use nom::combinator::*;
use nom::multi::{fold_many0, many1};
use nom::IResult;
use regex::Regex;
use std::collections::HashMap;
use std::fs;

use std::io::BufRead;
use std::io::BufReader;
use std::path::Path;
const LINES_TO_INSPECT: usize = 10;
const LINE_DETECTION_THRESHOLD: usize = 5;

#[derive(Debug, PartialEq, Eq, Hash, Clone)]
enum FormatPiece {
    Day,
    Month,
    Year,
    Hour,
    Minute,
    Second,
    Fraction,
    TimeZone,
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
            FormatPiece::SeperatorChar(_) => write!(f, "SeperatorChar"),
            FormatPiece::Seperator(_) => write!(f, "Seperator"),
        }
    }
}
fn days(input: &str) -> IResult<&str, FormatPiece> {
    map(take_while_m_n(2, 2, |c| c == 'D'), |_| FormatPiece::Day)(input)
}
fn month(input: &str) -> IResult<&str, FormatPiece> {
    map(take_while_m_n(2, 2, |c| c == 'M'), |_| FormatPiece::Month)(input)
}
fn year(input: &str) -> IResult<&str, FormatPiece> {
    map(take_while_m_n(4, 4, |c| c == 'Y'), |_| FormatPiece::Year)(input)
}
fn hours(input: &str) -> IResult<&str, FormatPiece> {
    map(take_while_m_n(2, 2, |c| c == 'h'), |_| FormatPiece::Hour)(input)
}
fn minutes(input: &str) -> IResult<&str, FormatPiece> {
    map(take_while_m_n(2, 2, |c| c == 'm'), |_| FormatPiece::Minute)(input)
}
fn seconds(input: &str) -> IResult<&str, FormatPiece> {
    map(take_while_m_n(2, 2, |c| c == 's'), |_| FormatPiece::Second)(input)
}
fn fraction(input: &str) -> IResult<&str, FormatPiece> {
    map(nom::character::complete::char('s'), |_| {
        FormatPiece::Fraction
    })(input)
}
fn timezone(input: &str) -> IResult<&str, FormatPiece> {
    map(tag("TZD"), |_| FormatPiece::TimeZone)(input)
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
        days, month, year, hours, minutes, seconds, fraction, timezone, seperator,
    ))(input)
}
fn escape_metacharacters(c: char) -> String {
    match c {
        //  .|?*+(){}[]DD
        ' ' => r"\s+".to_string(),
        '.' => r"\.".to_string(),
        '|' => r"\|".to_string(),
        '?' => r"\?".to_string(),
        '+' => r"\+".to_string(),
        '(' => r"\(".to_string(),
        ')' => r"\)".to_string(),
        '[' => r"\[".to_string(),
        '{' => r"\{".to_string(),
        '^' => r"\^".to_string(),
        '$' => r"\$".to_string(),
        '*' => r"\*".to_string(),
        c => c.to_string(),
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
fn date_expression(input: &str) -> IResult<&str, Vec<FormatPiece>> {
    let parser = fold_many0(
        any_date_format,
        (String::from(""), Vec::new()),
        |mut acc: (String, Vec<_>), item| {
            match item {
                FormatPiece::SeperatorChar(c) => acc.0.push_str(escape_metacharacters(c).as_str()),
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
    map(parser, |p: (String, Vec<FormatPiece>)| p.1)(input)
}

fn date_format_str_to_regex(date_format: &str) -> Result<Regex, failure::Error> {
    let format_pieces = date_expression(date_format);
    match format_pieces {
        Ok(r) => {
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
fn format_piece_as_regex_string(p: &FormatPiece) -> String {
    match p {
        FormatPiece::Day => String::from(r"(?P<d>\d{2})"),
        FormatPiece::Month => String::from(r"(?P<m>\d{2})"),
        FormatPiece::Year => String::from(r"(?P<Y>\d{4})"),
        FormatPiece::Hour => String::from(r"(?P<H>\d{2})"),
        FormatPiece::Minute => String::from(r"(?P<M>\d{2})"),
        FormatPiece::Second => String::from(r"(?P<S>\d{2})"),
        FormatPiece::Fraction => String::from(r"(?P<millis>\d+)"),
        FormatPiece::TimeZone => String::from(r"(?P<timezone>[\+\-]\d+)"),
        FormatPiece::SeperatorChar(c) => {
            let mut s = String::from("");
            s.push(*c);
            s
        }
        FormatPiece::Seperator(s) => s.to_string(),
    }
}
pub fn line_matching_format_expression(
    format_expr: &str,
    line: &str,
) -> Result<bool, failure::Error> {
    let regex = date_format_str_to_regex(format_expr)?;
    Ok(regex.is_match(line))
}
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
        parse_timezone(&caps["timezone"])
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
lazy_static! {
    pub static ref REGEX_REGISTRY: HashMap<RegexKind, Regex> = {
        let mut m = HashMap::new();

        // 05-22 12:36:36.506 +0100 I/GKI_LINUX1
        m.insert(RegexKind::R1,
            date_format_str_to_regex("MM-DD hh:mm:ss.s TZD").expect("should be parsed"));

        // 05-22-2019 12:36:04.344 A0
        m.insert(RegexKind::R2,
            date_format_str_to_regex("MM-DD-YYYY hh:mm:ss.s").expect("should be parsed"));

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
            Some(2017),
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

use nom::character::complete::char;
use nom::character::complete::digit1;

// fn many_spaces(input: &str) -> IResult<&str, char> {
//     map(many1(nom::character::complete::char(' ')), |_| ' ')(input)
// }
fn offset_from_timezone_in_ms(timezone: &str) -> Result<i64, failure::Error> {
    if timezone.len() != 5 {
        return Err(failure::err_msg(format!(
            "timezone had unexpected length of {}",
            timezone.len()
        )));
    }
    if !timezone.is_ascii() {
        return Err(failure::err_msg("timezone contained non-ascii characters"));
    }
    let positive: bool = timezone.starts_with('+');
    let absolute_hours: &i64 = &timezone[1..3].parse()?;
    let absolute_minutes: &i64 = &timezone[3..5].parse()?;
    let absolute = 1000 * (3600 * *absolute_hours + 60 * (*absolute_minutes));
    if positive {
        Ok(absolute)
    } else {
        Ok(-absolute)
    }
}

/// should parse timezone string, valid formats are
/// +hh:mm, +hhmm, or +hh
/// -hh:mm, -hhmm, or -hh
fn timezone_parser(input: &str) -> IResult<&str, i64> {
    let timezone_sign = map(nom::branch::alt((char('+'), char('-'))), |c| c == '+');
    fn timezone_count(input: &str) -> IResult<&str, i64> {
        let (rest, r) = nom::bytes::complete::take(2usize)(input)?;
        let second = map_res(digit1, |s: &str| s.parse::<i64>())(r)?;
        Ok((rest, second.1))
    }
    fn timezone_minutes(input: &str) -> IResult<&str, i64> {
        println!("timezone_minutes for {}", input);
        let res = nom::sequence::preceded(opt(char(':')), timezone_count)(input);
        println!("timezone_minutes res: {:?}", res);
        res
    }
    let parser = nom::sequence::tuple((timezone_sign, timezone_count, opt(timezone_minutes)));
    map(parser, |(positiv, hour, min): (bool, i64, Option<i64>)| {
        println!("hour {}, min: {:?}", hour, min);
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
    use std::path::PathBuf;

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
        assert_eq!(any_date_format("MM23"), Ok(("23", FormatPiece::Month)));
        assert_eq!(any_date_format("DDMM"), Ok(("MM", FormatPiece::Day)));
        assert_eq!(any_date_format("YYYY-"), Ok(("-", FormatPiece::Year)));
        assert_eq!(
            date_expression("DDMM"),
            Ok(("", vec![FormatPiece::Day, FormatPiece::Month]))
        );
        assert_eq!(
            date_expression("DD:MM"),
            Ok((
                "",
                vec![
                    FormatPiece::Day,
                    FormatPiece::Seperator(String::from(":")),
                    FormatPiece::Month
                ]
            ))
        );
        assert_eq!(
            date_expression("MMDD"),
            Ok(("", vec![FormatPiece::Month, FormatPiece::Day]))
        );
    }
    #[test]
    fn test_date_parsers_escapes() {
        assert_eq!(
            date_expression("MM   .|?*+(){}[]^$DD"),
            Ok((
                "",
                vec![
                    FormatPiece::Month,
                    FormatPiece::Seperator(String::from(r"\s+\.\|\?\*\+\(\)\{}\[]\^\$")),
                    FormatPiece::Day
                ]
            ))
        );
    }
    #[test]
    fn test_format_parsers() {
        // let input = "DD-MM hh:mm:ss:S TZD";
        assert_eq!(
            date_expression("DD-MM ---> hh:mm:ss:s TZD"),
            Ok((
                "",
                vec![
                    FormatPiece::Day,
                    FormatPiece::Seperator(String::from("-")),
                    FormatPiece::Month,
                    FormatPiece::Seperator(String::from(r"\s+--->\s+")),
                    FormatPiece::Hour,
                    FormatPiece::Seperator(String::from(":")),
                    FormatPiece::Minute,
                    FormatPiece::Seperator(String::from(":")),
                    FormatPiece::Second,
                    FormatPiece::Seperator(String::from(":")),
                    FormatPiece::Fraction,
                    FormatPiece::Seperator(String::from(r"\s+")),
                    FormatPiece::TimeZone,
                ]
            ))
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
    #[test]
    fn test_date_format_str_to_regex1() {
        // 05-22 12:36:36.506 +0100 I/GKI_LINUX1
        let input = "DD-MM hh:mm:ss.s TZD";
        let regex = date_format_str_to_regex(input).expect("should be parsed");
        assert_eq!(Regex::new(r"(?P<d>\d{2})-(?P<m>\d{2})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2})\.(?P<millis>\d+)\s+(?P<timezone>[\+\-]\d+)").unwrap().as_str(), regex.as_str());
    }
    #[test]
    fn test_date_format_str_to_regex2() {
        // 05-22-2019 12:36:04.344 A0
        let input2 = "DD-MM-YYYY hh:mm:ss.s";
        let regex2 = date_format_str_to_regex(input2).expect("should be parsed");
        assert_eq!(Regex::new(r"(?P<d>\d{2})-(?P<m>\d{2})-(?P<Y>\d{4})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2})\.(?P<millis>\d+)").unwrap().as_str(), regex2.as_str());
    }
    #[test]
    fn test_date_format_str_to_regex_with_escape_characters() {
        // 05|22|2019
        let regex = date_format_str_to_regex("DD|MM|YYYY").expect("should be parsed");
        assert_eq!(
            Regex::new(r"(?P<d>\d{2})\|(?P<m>\d{2})\|(?P<Y>\d{4})")
                .unwrap()
                .as_str(),
            regex.as_str()
        );
    }
    #[test]
    fn test_date_format_str_to_regex_other() {
        assert!(
            line_matching_format_expression("YYYY-MM-DDThh:mmTZD", "1997-07-16T19:20+01:00")
                .unwrap_or(false)
        );
        assert!(line_matching_format_expression("YYYY", "1997").unwrap_or(false));

        assert!(line_matching_format_expression("YYYY-MM", "1997-07").unwrap_or(false));

        assert!(line_matching_format_expression("YYYY-MM-DD", "1997-07-16").unwrap_or(false));

        assert!(
            line_matching_format_expression("YYYY-MM-DDThh:mmTZD", "1997-07-16T19:20+01:00")
                .unwrap_or(false)
        );

        assert!(line_matching_format_expression(
            "YYYY-MM-DDThh:mm:ssTZD",
            "1997-07-16T19:20:30+01:00"
        )
        .unwrap_or(false));

        assert!(line_matching_format_expression(
            "YYYY-MM-DDThh:mm:ss.sTZD",
            "1997-07-16T19:20:30.45+01:00"
        )
        .unwrap_or(false));
        assert!(line_matching_format_expression(
            "YYYY-MM-DDThh:mm:ss.sTZD",
            "1997-07-16T19:20:30.45+01:00"
        )
        .unwrap_or(false));
        assert!(
            line_matching_format_expression("YYYYMMDDhhmmsssTZD", "1997071619203045+01:00")
                .unwrap_or(false)
        );
    }
    #[test]
    fn test_parse_date_line_no_year_with_timezone() {
        let input = "04-04 11:52:50.229 +0200 D/oup.csc(  665): [728] MqttLogger";

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
        .expect("convert to limed line should work");
        println!("timestamp: {}, tag: {}", timestamp, tag);
        assert_eq!(1_491_299_570_229, timestamp);
        assert_eq!(input, content);
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
