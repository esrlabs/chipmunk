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
use indexer_base::chunks::ChunkFactory;
use indexer_base::timedline::*;
use indexer_base::error_reporter::*;
use indexer_base::utils;
use processor::parse::{lookup_regex_for_format_str, line_to_timed_line};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::BinaryHeap;
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::iter::{Iterator, Peekable};
use std::path::{Path, PathBuf};

const REPORT_PROGRESS_LINE_BLOCK: usize = 500_000;

pub struct Merger {
    pub chunk_size: usize, // used for mapping line numbers to byte positions
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MergeItemOptions {
    name: String,
    offset: Option<i64>,
    year: Option<i32>,
    tag: String,
    format: String,
}

pub fn read_merge_options(f: &mut fs::File) -> Result<Vec<MergeItemOptions>, failure::Error> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)
        .expect("something went wrong reading the file");

    let v: Vec<MergeItemOptions> = serde_json::from_str(&contents[..])?; //.expect("could not parse merge item file");
    Ok(v)
}

pub struct MergerInput {
    path: PathBuf,
    offset: Option<i64>,
    year: Option<i32>,
    format: String,
    tag: String,
}
pub struct TimedLineIter<'a> {
    reader: BufReader<fs::File>,
    tag: &'a str,
    regex: Regex,
    year: Option<i32>,
    time_offset: Option<i64>,
    last_timestamp: i64,
    pub current_line_nr: usize,
    reporter: Reporter,
}
impl<'a> TimedLineIter<'a> {
    pub fn new(
        fh: fs::File,
        tag: &'a str,
        regex: Regex,
        year: Option<i32>,
        time_offset: Option<i64>,
        current_line_nr: usize,
    ) -> TimedLineIter<'a> {
        TimedLineIter {
            reader: BufReader::new(fh),
            tag,
            regex,
            year,
            time_offset,
            last_timestamp: 0,
            current_line_nr,
            reporter: Default::default(),
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
                    self.reporter.flush();
                    return None;
                }
                let original_line_length = len;
                let s = unsafe { std::str::from_utf8_unchecked(&buf) };
                let trimmed_line = s.trim_matches(utils::is_newline);
                let timed_line = line_to_timed_line(
                    trimmed_line,
                    original_line_length,
                    self.tag,
                    &self.regex,
                    self.year,
                    self.time_offset,
                    self.current_line_nr,
                    &mut self.reporter,
                )
                .unwrap_or_else(|_| TimedLine {
                    content: trimmed_line.to_string(),
                    tag: self.tag.to_string(),
                    timestamp: self.last_timestamp,
                    original_length: original_line_length,
                    year_was_missing: false,
                    line_nr: self.current_line_nr,
                });
                self.last_timestamp = timed_line.timestamp;
                self.current_line_nr += 1;
                Some(timed_line)
            }
            Err(_) => None,
        }
    }
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
        report_status: bool,
    ) -> Result<usize, failure::Error> {
        let mut merge_option_file = fs::File::open(config_path)?;
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
                format: o.format,
                tag: o.tag,
            })
            .collect();
        self.merge_files_iter(append, inputs, &out_path, use_stdout, report_status)
    }
    #[allow(dead_code)]
    pub fn merge_and_sort_files(
        &self,
        merger_inputs: Vec<MergerInput>,
        out_path: &PathBuf,
        append: bool,
        to_stdout: bool,
    ) -> Result<usize, failure::Error> {
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
        let mut lines_with_year_missing = 0usize;
        let mut lines_where_we_reuse_previous_date = 0usize;
        let mut reporter: Reporter = Default::default();

        for input in merger_inputs {
            // let kind: RegexKind = detect_timestamp_regex(&input.path)?;
            // let r: &Regex = &REGEX_REGISTRY[&kind];
            let r = lookup_regex_for_format_str(&input.format)?;
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
                    line_nr,
                    &mut reporter,
                )
                .unwrap_or_else(|_| {
                    lines_where_we_reuse_previous_date += 1;
                    TimedLine {
                        content: trimmed_line.to_string(),
                        tag: alt_tag.to_string(),
                        timestamp: last_timestamp,
                        original_length: len,
                        year_was_missing: false,
                        line_nr,
                    }
                });
                if timed_line.year_was_missing {
                    lines_with_year_missing += 1
                }
                last_timestamp = timed_line.timestamp;
                heap.push(timed_line);
                buf = vec![];
            }
        }
        if lines_with_year_missing > 0 {
            report_warning(format!(
                "year was missing for {} lines",
                lines_with_year_missing
            ));
        }
        if lines_where_we_reuse_previous_date > 0 {
            report_warning(format!(
                "could not determine date for {} lines",
                lines_where_we_reuse_previous_date
            ));
        }
        let sorted = heap.into_sorted_vec();
        for t in sorted {
            utils::create_tagged_line(&t.tag[..], &mut buf_writer, &t.content[..], line_nr, true)?;
            let trimmed_len = t.content.len();
            let additional_bytes =
                utils::extended_line_length(trimmed_len, t.tag.len(), line_nr, true);
            line_nr += 1;
            if let Some(chunk) = chunk_factory.create_chunk_if_needed(
                line_nr, // TODO avoid passing in this line...error prone
                additional_bytes,
            ) {
                chunks.push(chunk);
            }
        }
        buf_writer.flush()?;
        if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunks.is_empty()) {
            chunks.push(chunk);
        }
        Ok(line_nr)
    }

    pub fn merge_files_iter(
        &self,
        append: bool,
        merger_inputs: Vec<MergerInput>,
        out_path: &PathBuf,
        to_stdout: bool,
        report_status: bool,
    ) -> Result<usize, failure::Error> {
        let out_file: std::fs::File = if append {
            std::fs::OpenOptions::new()
                .append(true)
                .create(true)
                .open(out_path)?
        } else {
            std::fs::File::create(&out_path)?
        };
        let mut line_nr = if append {
            utils::next_line_nr(&out_path)
                .ok_or_else(|| failure::format_err!("could not get last line number of old file"))?
        } else {
            0
        };
        let original_file_size = out_file.metadata()?.len() as usize;

        let mut chunks = vec![];
        let mut chunk_factory = ChunkFactory::new(self.chunk_size, to_stdout, original_file_size);
        let mut processed_bytes = 0;
        let mut lines_with_year_missing = 0usize;
        let mut readers: Vec<Peekable<TimedLineIter>> = merger_inputs
            .iter()
            .map(|input| {
                fs::File::open(&input.path)
                    .map_err(failure::Error::from)
                    .and_then(|f| {
                        let r: Regex = lookup_regex_for_format_str(&input.format)?;
                        Ok(TimedLineIter::new(
                            f,
                            input.tag.as_str(),
                            r,
                            input.year,
                            input.offset,
                            line_nr,
                        )
                        .peekable())
                    })
            })
            .filter_map(Result::ok) // TODO better error handling
            .collect();
        // MergerInput
        let combined_source_file_size = merger_inputs
            .iter()
            .fold(0, |acc, i| acc + file_size(&i.path));

        let mut buf_writer = BufWriter::with_capacity(100 * 1024 * 1024, out_file);
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
                    if line.year_was_missing {
                        lines_with_year_missing += 1
                    }
                }
            }
            if let Some((_, min_index)) = minimum {
                if let Some(line) = readers[min_index].next() {
                    processed_bytes += line.original_length;
                    let trimmed_len = line.content.len();
                    if trimmed_len > 0 {
                        utils::create_tagged_line(
                            &line.tag,
                            &mut buf_writer,
                            &line.content,
                            line_nr,
                            true,
                        )?;
                        let additional_bytes =
                            utils::extended_line_length(trimmed_len, line.tag.len(), line_nr, true);
                        line_nr += 1;
                        if let Some(chunk) = chunk_factory.create_chunk_if_needed(
                            line_nr, // TODO avoid passing in this line...error prone
                            additional_bytes,
                        ) {
                            chunks.push(chunk);
                            buf_writer.flush()?;
                        }

                        if report_status {
                            utils::report_progress(
                                line_nr,
                                chunk_factory.get_current_byte_index(),
                                processed_bytes,
                                combined_source_file_size as usize,
                                REPORT_PROGRESS_LINE_BLOCK,
                            );
                        }
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        if lines_with_year_missing > 0 {
            report_warning(format!(
                "year was missing for {} lines",
                lines_with_year_missing
            ));
        }
        buf_writer.flush()?;
        if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunks.is_empty()) {
            chunks.push(chunk);
        }
        Ok(line_nr)
    }
}
