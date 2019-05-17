use crate::chunks::ChunkFactory;
use crate::utils;
use chrono::{NaiveDate, NaiveDateTime};
use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::BinaryHeap;
use std::collections::HashMap;
use std::fs;
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::iter::{Iterator, Peekable};
use std::path::{Path, PathBuf};

const LINES_TO_INSPECT: usize = 10;
const LINE_DETECTION_THRESHOLD: usize = 5;
const REPORT_PROGRESS_LINE_BLOCK: usize = 500_000;

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
            r"(?x)^(?P<m>\d{2})-(?P<d>\d{2})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2}).(?P<millis>\d+)\s(?P<timezone>[\+\-]\d+)"
        ).unwrap());
        m.insert(RegexKind::R2, Regex::new(
            r"(?x)^(?P<m>\d{2})-(?P<d>\d{2})-(?P<Y>\d{4})\s+(?P<H>\d{2}):(?P<M>\d{2}):(?P<S>\d{2}).(?P<millis>\d+)",
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
    original_length: usize,
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

fn line_to_timed_line(
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
    Ok(v)
}

pub struct MergerInput {
    path: PathBuf,
    offset: Option<i64>,
    year: Option<i32>,
    tag: String,
}

fn file_size(path: &Path) -> u64 {
    let metadata = fs::metadata(path).expect("cannot read size of output file");
    metadata.len()
}
impl Merger {
    pub fn merge_files_use_config_file(
        &self,
        config_path: &PathBuf,
        out_path: &PathBuf,
        append: bool,
        use_stdout: bool,
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
        // self.merge_files(inputs, &out_path, append, use_stdout)
        self.merge_files_iter(append, inputs, &out_path, use_stdout)
    }
    #[allow(dead_code)]
    pub fn merge_files(
        &self,
        merger_inputs: Vec<MergerInput>,
        out_path: &PathBuf,
        append: bool,
        to_stdout: bool,
    ) -> ::std::result::Result<usize, failure::Error> {
        let mut heap: BinaryHeap<TimedLine> = BinaryHeap::new();
        let mut line_nr = 0;
        let out_file: std::fs::File = if append {
            std::fs::OpenOptions::new()
                .append(true)
                .open(out_path)
                .expect("could not open file to append")
        } else {
            std::fs::File::create(&out_path).unwrap()
        };
        let original_file_size =
            out_file.metadata().expect("could not read metadata").len() as usize;
        let mut chunks = vec![];
        let mut chunk_factory = ChunkFactory::new(self.chunk_size, to_stdout, original_file_size);
        let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);

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
                let s = unsafe { std::str::from_utf8_unchecked(&buf) };
                let trimmed_line = s.trim_matches(utils::is_newline);
                let alt_tag = input.tag.clone();
                let timed_line = line_to_timed_line(
                    trimmed_line,
                    len,
                    &input.tag[..],
                    &r,
                    input.year,
                    input.offset,
                )
                .unwrap_or_else(|| TimedLine {
                    content: trimmed_line.to_string(),
                    tag: alt_tag.to_string(),
                    timestamp: last_timestamp,
                    original_length: len,
                });
                last_timestamp = timed_line.timestamp;
                heap.push(timed_line);
                buf = vec![];
            }
        }
        let mut immediate_output = String::new();
        let sorted = heap.into_sorted_vec();
        for t in sorted {
            utils::create_tagged_line(&t.tag[..], &mut buf_writer, &t.content[..], line_nr, true)
                .expect("could not create tagged line");
            let trimmed_len = t.content.len();
            let additional_bytes =
                utils::extended_line_length(trimmed_len, t.tag.len(), line_nr, true);
            line_nr += 1;
            if let Some(chunk) = chunk_factory.create_chunk_if_needed(
                line_nr, // TODO avoid passing in this line...error prone
                additional_bytes,
                &mut immediate_output,
            ) {
                chunks.push(chunk);
            }
        }
        buf_writer.flush()?;
        if to_stdout {
            print!("{}", immediate_output);
            immediate_output.clear();
        }
        if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunks.is_empty()) {
            chunks.push(chunk);
        }
        Ok(line_nr)
    }
    #[allow(dead_code)]
    pub fn merge_files_iter(
        &self,
        append: bool,
        merger_inputs: Vec<MergerInput>,
        out_path: &PathBuf,
        to_stdout: bool,
    ) -> ::std::result::Result<usize, failure::Error> {
        let out_file: std::fs::File = if append {
            std::fs::OpenOptions::new()
                .append(true)
                .open(out_path)
                .expect("could not open file to append")
        } else {
            std::fs::File::create(&out_path).unwrap()
        };
        let mut line_nr = if append {
            utils::last_line_nr(&out_path)
                .ok_or_else(|| failure::format_err!("could not get last line number of old file"))?
                + 1
        } else {
            0
        };
        let original_file_size =
            out_file.metadata().expect("could not read metadata").len() as usize;

        let mut chunks = vec![];
        let mut chunk_factory = ChunkFactory::new(self.chunk_size, to_stdout, original_file_size);
        let mut processed_bytes = 0;
        let mut readers: Vec<Peekable<TimedLineIter>> = merger_inputs
            .iter()
            .map(|input| {
                fs::File::open(&input.path)
                    .map_err(failure::Error::from)
                    .and_then(|f| detect_timestamp_regex(&input.path).map(|r| (f, r)))
                    .and_then(|(f, kind)| {
                        let r: &Regex = &REGEX_REGISTRY[&kind];
                        Ok(
                            TimedLineIter::new(f, input.tag.as_str(), r, input.year, input.offset)
                                .peekable(),
                        )
                    })
            })
            .filter_map(std::result::Result::ok) // TODO better error handling
            .collect();
        // MergerInput
        let combined_source_file_size = merger_inputs
            .iter()
            .fold(0, |acc, i| acc + file_size(&i.path));

        let mut buf_writer = BufWriter::with_capacity(100 * 1024 * 1024, out_file);
        let mut immediate_output = String::new();
        loop {
            let mut minimum: Option<(i64, usize)> = None;
            for (i, iter) in readers.iter_mut().enumerate() {
                if let Some(line) = iter.peek() {
                    match minimum {
                        Some((t_min, _)) => {
                            if line.timestamp < t_min {
                                minimum = Some((line.timestamp, i));
                            }
                        }
                        None => {
                            minimum = Some((line.timestamp, i));
                        }
                    }
                }
            }
            if let Some((_, min_index)) = minimum {
                if let Some(line) = readers[min_index].next() {
                    let trimmed_len = line.content.len();
                    if trimmed_len > 0 {
                        processed_bytes += line.original_length;
                        utils::create_tagged_line(
                            &line.tag,
                            &mut buf_writer,
                            &line.content,
                            line_nr,
                            true,
                        )
                        .expect("could not create tagged line");
                        let additional_bytes =
                            utils::extended_line_length(trimmed_len, line.tag.len(), line_nr, true);
                        line_nr += 1;
                        if let Some(chunk) = chunk_factory.create_chunk_if_needed(
                            line_nr, // TODO avoid passing in this line...error prone
                            additional_bytes,
                            &mut immediate_output,
                        ) {
                            chunks.push(chunk);
                        }

                        self.report_progress(
                            line_nr,
                            chunk_factory.get_current_byte_index(),
                            processed_bytes,
                            combined_source_file_size as usize,
                        );
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        // while let Some((i, l)) = readers
        //     .iter_mut()
        //     .filter_map(|i| {
        //         println!("iter over readers");
        //         if let Ok(i) = i {
        //             let line: TimedLine = if let Some(line) = i.peek() {
        //                 println!("iter, line: {:?}", line);
        //                 line.clone()
        //             } else {
        //                 return None;
        //             };
        //             Some((i, line))
        //         } else {
        //             panic!()
        //         }
        //     })
        //     .min_by_key(|(_, s)| (*s).clone())
        // {
        //     i.next();
        //     buf_writer
        //         .write_all(l.content.as_bytes())
        //         .expect("Failed to write");
        //     buf_writer.write_all(&[b'\n']).expect("Failed to write");
        // }
        buf_writer.flush()?;
        if to_stdout {
            print!("{}", immediate_output);
            immediate_output.clear();
        }
        if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunks.is_empty()) {
            chunks.push(chunk);
        }
        Ok(line_nr)
    }

    #[inline]
    fn report_progress(
        &self,
        line_nr: usize,
        current_byte_index: usize,
        processed_bytes: usize,
        source_file_size: usize,
    ) {
        if line_nr % REPORT_PROGRESS_LINE_BLOCK == 0 {
            eprintln!(
                "processed {} lines -- byte-index {} ({} %)",
                line_nr,
                current_byte_index,
                (processed_bytes as f32 / source_file_size as f32 * 100.0).round()
            );
        }
    }
}
#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;
    use pretty_assertions::assert_eq;
    use std::fs;
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
    const TWO_HOURS_IN_MS: i64 = 2 * 3600 * 1000;
    #[test]
    fn test_parse_date_line_year_no_timezone() {
        let input =
            "04-04-2017 11:52:50.229 0 0.764564113869644 0.7033032911158661 0.807587397462308";
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

    test_generator::test_expand_paths! { test_merge_files; "test_samples/merging/*" }

    fn test_merge_files(dir_name: &str) {
        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        let option_path = PathBuf::from(&dir_name).join("config.json");
        let append_to_this = PathBuf::from(&dir_name).join("append_here.log");
        let append_use_case = append_to_this.exists();
        if append_use_case {
            fs::copy(&append_to_this, &out_file_path).expect("copy content failed");
            println!("copied from {:?}", append_to_this);
            let content = fs::read_to_string(append_to_this).expect("could not read file");
            println!("content was: {:?}", content);
            println!("copied content to: {:?}", out_file_path);
            let content2 = fs::read_to_string(&out_file_path).expect("could not read file");
            println!("copied content was: {:?}", content2);
        }

        let merger = Merger {
            max_lines: 5,
            chunk_size: 5,
        };
        let merged_lines_cnt = merger.merge_files_use_config_file(
            &option_path,
            &out_file_path,
            append_use_case,
            false, // use stdout
        );
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
