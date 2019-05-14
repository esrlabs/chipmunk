use crate::utils::{create_tagged_line, is_newline};
use chrono::{NaiveDate, NaiveDateTime};
use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::BinaryHeap;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};

const LINES_TO_INSPECT: usize = 10;
const LINE_DETECTION_THRESHOLD: usize = 5;

pub struct Merger {
    pub max_lines: usize,  // how many lines to collect before writing out
    pub chunk_size: usize, // used for mapping line numbers to byte positions
}
#[derive(Debug, PartialEq, Eq, Hash, Clone)]
enum RegexKind {
    /// use R1 for files with this kind of timestamp: "04-04 11:52:50.229 +0200 ...";
    /// contains timezone but no year
    R1 = 1,
    /// use R2 for files with this kind of timestamp: "04-04-2017 11:52:50.229 ...";
    /// contains year but no timezone
    R2 = 2,
}
impl RegexKind {
    #[allow(dead_code)]
    fn from_u32(value: u32) -> RegexKind {
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
    static ref REGEX_REGISTRY: HashMap<RegexKind, Regex> = {
        let mut m = HashMap::new();
        m.insert(RegexKind::R1, Regex::new(
            r"(?x)^(?P<d>\d{2})-(?P<m>\d{2})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2}).(?P<millis>\d+)\s(?P<timezone>[\+\-]\d+)"
        ).unwrap());
        m.insert(RegexKind::R2, Regex::new(
            r"(?x)^(?P<d>\d{2})-(?P<m>\d{2})-(?P<Y>\d{4})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2}).(?P<millis>\d+)",
        ).unwrap());
        m
    };
    static ref REGEX_COUNT: usize = REGEX_REGISTRY.len();
}

#[derive(Clone, Eq, PartialEq, Debug)]
pub struct TimedLine {
    timestamp: i64,
    content: String,
    tag: String,
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

fn detect_timestamp_regex(path: &Path) -> Result<RegexKind, failure::Error> {
    let f: fs::File = fs::File::open(path)?;
    let mut reader: BufReader<&std::fs::File> = BufReader::new(&f);

    let mut buf = vec![];
    let mut matched_lines_regex_01 = 0;
    let mut matched_lines_regex_02 = 0;
    let mut inspected_lines = 0;
    while let Ok(_) = reader.read_until(b'\n', &mut buf) {
        unsafe {
            let s = std::str::from_utf8_unchecked(&buf);
            matched_lines_regex_01 = match line_to_timed_line(
                s,
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
                "TAG",
                &REGEX_REGISTRY[&RegexKind::R2],
                Some(3333),
                Some(0),
            ) {
                Some(_) => matched_lines_regex_02 + 1,
                None => matched_lines_regex_02,
            };
            inspected_lines += 1;
            buf = vec![];
            if inspected_lines > LINES_TO_INSPECT {
                break;
            }
        }
    }
    if matched_lines_regex_01 > LINE_DETECTION_THRESHOLD
        && matched_lines_regex_01 > matched_lines_regex_02
    {
        return Ok(RegexKind::R1);
    }
    if matched_lines_regex_02 > LINE_DETECTION_THRESHOLD
        && matched_lines_regex_02 > matched_lines_regex_01
    {
        return Ok(RegexKind::R2);
    }
    Err(failure::err_msg(format!(
        "could not detect timestamp in {:?}",
        path
    )))
}
fn line_to_timed_line(
    line: &str,
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
    // println!(
    //     "{} => d,m: {:?} h,m,s,ms: {:?}",
    //     line,
    //     (day, month),
    //     (hour, minutes, seconds, millis)
    // );

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
            let date_time: NaiveDateTime =
                NaiveDate::from_ymd(y, month, day).and_hms_milli(hour, minutes, seconds, millis);
            let unix_timestamp = date_time.timestamp_millis();
            Some(TimedLine {
                timestamp: unix_timestamp - offset,
                content: line.to_string(),
                tag: tag.to_string(),
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

#[derive(Serialize, Deserialize, Debug)]
pub struct MergeItemOptions {
    name: String,
    offset: Option<i64>,
    year: Option<i32>,
    tag: String,
}

pub fn read_merge_options(f: &mut fs::File) -> Result<Vec<MergeItemOptions>, failure::Error> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)
        .expect("something went wrong reading the file");

    let v: Vec<MergeItemOptions> =
        serde_json::from_str(&contents[..]).expect("could not parse merge item file");
    // println!("merge-file-options: {:?}", v);
    Ok(v)
}

pub struct MergerInput {
    path: PathBuf,
    offset: Option<i64>,
    year: Option<i32>,
    tag: String,
}

impl Merger {
    pub fn merge_files_use_config_file(
        &self,
        config_path: &PathBuf,
        out_path: &PathBuf,
        append: bool,
    ) -> ::std::result::Result<usize, failure::Error> {
        let mut merge_option_file = fs::File::open(config_path).unwrap();
        let dir_name = config_path
            .parent()
            .ok_or_else(|| failure::err_msg("could not find directory of config file"))?;
        let options: Vec<MergeItemOptions> = read_merge_options(&mut merge_option_file)?;
        let inputs: Vec<MergerInput> = options
            .into_iter()
            .map(|o: MergeItemOptions| MergerInput {
                path: PathBuf::from(&dir_name).join(o.name),
                offset: o.offset,
                year: o.year,
                tag: o.tag,
            })
            .collect();
        self.merge_files(inputs, &out_path, append)
    }
    pub fn merge_files(
        &self,
        merger_inputs: Vec<MergerInput>,
        out_path: &PathBuf,
        append: bool,
    ) -> ::std::result::Result<usize, failure::Error> {
        let mut heap: BinaryHeap<TimedLine> = BinaryHeap::new();
        let mut line_nr = 0;
        for input in merger_inputs {
            let kind: RegexKind = detect_timestamp_regex(&input.path)?;
            let r: &Regex = &REGEX_REGISTRY[&kind];
            let f: fs::File = fs::File::open(input.path)?;
            let mut reader: BufReader<&std::fs::File> = BufReader::new(&f);
            let mut buf = vec![];
            let mut last_timestamp: i64 = 0;
            while let Ok(len) = reader.read_until(b'\n', &mut buf) {
                if len == 0 {
                    // no more content
                    break;
                };
                unsafe {
                    let s = std::str::from_utf8_unchecked(&buf);
                    let trimmed_line = s.trim_matches(is_newline);
                    let alt_tag = input.tag.clone();
                    let timed_line = line_to_timed_line(
                        trimmed_line,
                        &input.tag[..],
                        &r,
                        input.year,
                        input.offset,
                    )
                    .unwrap_or_else(|| TimedLine {
                        content: trimmed_line.to_string(),
                        tag: alt_tag.to_string(),
                        timestamp: last_timestamp,
                    });
                    last_timestamp = timed_line.timestamp;
                    heap.push(timed_line);
                }
                buf = vec![];
            }
        }
        let sorted = heap.into_sorted_vec();
        let mut out_file: std::fs::File = if append {
            std::fs::OpenOptions::new()
                .append(true)
                .open(out_path)
                .expect("could not open file to append")
        } else {
            std::fs::File::create(&out_path).unwrap()
        };
        let out_content: Vec<String> = sorted
            .into_iter()
            .map(|t: TimedLine| {
                let mut out_buffer = String::new();
                create_tagged_line(&t.tag[..], &mut out_buffer, &t.content[..], line_nr, true)
                    .expect("could not create tagged line");
                line_nr += 1;
                out_buffer
            })
            .collect();
        // for s in out_content.clone() {
        //     println!(">> {:?}", s);
        // }
        let _ = out_file.write_all(out_content.join("").as_bytes());
        Ok(out_content.len())
    }
}
#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;
    use pretty_assertions::assert_eq;
    use tempdir::TempDir;

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
        let TimedLine {
            timestamp,
            content,
            tag,
        } = line_to_timed_line(
            input,
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
    const TWO_HOURS_IN_MS: i64 = 2 * 3600 * 1000;
    #[test]
    fn test_parse_date_line_year_no_timezone() {
        let input =
            "04-04-2017 11:52:50.229 0 0.764564113869644 0.7033032911158661 0.807587397462308";
        let TimedLine {
            timestamp,
            content,
            tag,
        } = line_to_timed_line(
            input,
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

    test_generator::test_expand_paths! { test_detect_regex; "test_samples/detecting/*" }

    fn test_detect_regex(dir_name: &str) {
        let in_path = PathBuf::from(&dir_name).join("in.log");
        let res = detect_timestamp_regex(&in_path).expect("could not detect regex type");

        let mut format_path = PathBuf::from(&dir_name);
        format_path.push("expected.format");
        let contents =
            std::fs::read_to_string(format_path).expect("Something went wrong reading the file");
        let expected_regex_number: u32 = contents
            .trim()
            .parse()
            .expect("could not parse expected format");
        let expected_regex_kind = RegexKind::from_u32(expected_regex_number);
        assert_eq!(expected_regex_kind, res);
    }

    test_generator::test_expand_paths! { test_merge_files; "test_samples/merging/*" }

    fn test_merge_files(dir_name: &str) {
        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        let option_path = PathBuf::from(&dir_name).join("config.json");

        let merger = Merger {
            max_lines: 5,
            chunk_size: 5,
        };
        let merged_lines_cnt =
            merger.merge_files_use_config_file(&option_path, &out_file_path, false);
        println!("merged_lines_cnt: {:?}", merged_lines_cnt);

        let out_file_content_bytes = fs::read(out_file_path).expect("could not read file");
        let out_file_content = String::from_utf8_lossy(&out_file_content_bytes[..]);
        let mut expected_path = PathBuf::from(&dir_name);
        expected_path.push("expected.merged");
        let expected_content_bytes = fs::read(expected_path).expect("could not read expected file");
        let expected_content = String::from_utf8_lossy(&expected_content_bytes[..]);
        println!(
            "comparing\n{}\nto expected:\n{}",
            out_file_content, expected_content
        );
        assert_eq!(expected_content, out_file_content);
    }
    // TODO test files with lines without timestamp
}
