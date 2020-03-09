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
use crossbeam_channel as cc;
use failure::err_msg;
use indexer_base::chunks::ChunkFactory;
use indexer_base::chunks::ChunkResults;
use indexer_base::error_reporter::*;
use indexer_base::progress::IndexingProgress;
use indexer_base::timedline::*;
use indexer_base::utils;
use processor::parse::{line_to_timed_line, lookup_regex_for_format_str};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::BinaryHeap;
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::iter::{Iterator, Peekable};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug)]
pub struct MergeItemOptions {
    pub name: String,
    pub offset: Option<i64>,
    pub year: Option<i32>,
    pub tag: String,
    pub format: String,
}

pub fn read_merge_options(f: &mut fs::File) -> Result<Vec<MergeItemOptions>, failure::Error> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)?;

    let v: Vec<MergeItemOptions> = serde_json::from_str(&contents[..])?;
    Ok(v)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MergerInput {
    pub path: PathBuf,
    pub offset: Option<i64>,
    pub year: Option<i32>,
    pub format: String,
    pub tag: String,
}
pub struct TimedLineIter<'a, T: Read> {
    reader: BufReader<T>,
    tag: &'a str,
    regex: Regex,
    year: Option<i32>,
    time_offset: Option<i64>,
    last_timestamp: i64,
    pub current_line_nr: usize,
    reporter: Reporter,
}
impl<'a, T> TimedLineIter<'a, T>
where
    T: Read,
{
    pub fn new(
        read_from: T,
        tag: &'a str,
        regex: Regex,
        year: Option<i32>,
        time_offset: Option<i64>,
        current_line_nr: usize,
    ) -> TimedLineIter<'a, T> {
        TimedLineIter {
            reader: BufReader::new(read_from),
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
impl<'a, T> Iterator for TimedLineIter<'a, T>
where
    T: Read,
{
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
#[allow(clippy::too_many_arguments)]
pub fn merge_files_use_config_file(
    config_path: &PathBuf,
    out_path: &PathBuf,
    append: bool,
    chunk_size: usize, // used for mapping line numbers to byte positions
    update_channel: cc::Sender<ChunkResults>,
    shutdown_rx: Option<cc::Receiver<()>>,
) -> Result<(), failure::Error> {
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
    merge_files_iter(
        append,
        inputs,
        &out_path,
        chunk_size,
        update_channel,
        shutdown_rx,
    )
}
#[allow(dead_code)]
pub fn merge_and_sort_files(
    merger_inputs: Vec<MergerInput>,
    out_path: &PathBuf,
    append: bool,
    chunk_size: usize, // used for mapping line numbers to byte positions
) -> Result<(), failure::Error> {
    let mut heap: BinaryHeap<TimedLine> = BinaryHeap::new();
    let mut line_nr = 0;
    let out_file: std::fs::File = if append {
        std::fs::OpenOptions::new().append(true).open(out_path)?
    } else {
        std::fs::File::create(&out_path)?
    };
    let original_file_size = out_file.metadata()?.len() as usize;
    let mut chunks = vec![];
    let mut chunk_factory = ChunkFactory::new(chunk_size, original_file_size);
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
        let additional_bytes = utils::write_tagged_line(
            &t.tag[..],
            &mut buf_writer,
            &t.content[..],
            line_nr,
            true,
            None,
        )?;
        line_nr += 1;
        if let Some(chunk) = chunk_factory.create_chunk_if_needed(
            line_nr, // TODO avoid passing in this line...error prone
            additional_bytes,
        ) {
            chunks.push(chunk)
        }
    }
    buf_writer.flush()?;
    if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunks.is_empty()) {
        chunks.push(chunk);
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn merge_files_iter(
    append: bool,
    merger_inputs: Vec<MergerInput>,
    out_path: &PathBuf,
    chunk_size: usize, // used for mapping line numbers to byte positions
    update_channel: cc::Sender<ChunkResults>,
    shutdown_rx: Option<cc::Receiver<()>>,
) -> Result<(), failure::Error> {
    let out_file: std::fs::File = if append {
        std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(out_path)?
    } else {
        std::fs::File::create(&out_path)?
    };
    let mut line_nr = if append {
        utils::next_line_nr(&out_path)?
    } else {
        0
    };
    let original_file_size = out_file.metadata()?.len() as usize;
    let mut chunk_count = 0usize;
    let mut chunk_factory = ChunkFactory::new(chunk_size, original_file_size);
    let mut processed_bytes = 0;
    let mut lines_with_year_missing = 0usize;
    let mut stopped = false;

    let mut progress_percentage = 0usize;
    // create a peekable iterator for all file inputs
    let mut readers: Vec<Peekable<TimedLineIter<fs::File>>> = merger_inputs
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
    let combined_source_file_size = merger_inputs.iter().try_fold(0, |acc, i| {
        let f = &i.path.clone();
        match fs::metadata(f) {
            Ok(metadata) => Ok(acc + metadata.len()),
            Err(e) => Err(err_msg(format!(
                "error getting size of file {:?} ({})",
                f, e
            ))),
        }
    })?;

    let mut buf_writer = BufWriter::with_capacity(100 * 1024 * 1024, out_file);
    loop {
        if stopped {
            info!("we where stopped while merging");
            break;
        }
        // keep track of the min timestamp together with the index of the file it belongs to
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
            // we found a line with a minimal timestamp
            if let Some(line) = readers[min_index].next() {
                // important: keep track of how many bytes we processed
                processed_bytes += line.original_length;
                let trimmed_len = line.content.len();
                if trimmed_len > 0 {
                    let additional_bytes = utils::write_tagged_line(
                        &line.tag,
                        &mut buf_writer,
                        &line.content,
                        line_nr,
                        true,
                        None,
                    )?;
                    line_nr += 1;
                    if let Some(chunk) = chunk_factory.create_chunk_if_needed(
                        line_nr, // TODO avoid passing in this line...error prone
                        additional_bytes,
                    ) {
                        stopped = utils::check_if_stop_was_requested(&shutdown_rx, "merger");
                        chunk_count += 1;
                        buf_writer.flush()?;
                        update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }))?;
                    }

                    let new_progress_percentage: usize =
                        (processed_bytes as f64 / combined_source_file_size as f64 * 100.0).round()
                            as usize;
                    if new_progress_percentage != progress_percentage {
                        progress_percentage = new_progress_percentage;
                        update_channel.send(Ok(IndexingProgress::Progress {
                            ticks: (processed_bytes, combined_source_file_size as usize),
                        }))?;
                    }
                }
            } else {
                break;
            }
        } else {
            break;
        }
    }
    if stopped {
        debug!("sending IndexingProgress::Stopped");
        update_channel.send(Ok(IndexingProgress::Stopped))?;
    } else {
        if lines_with_year_missing > 0 {
            report_warning(format!(
                "year was missing for {} lines",
                lines_with_year_missing
            ));
        }
        buf_writer.flush()?;
        if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunk_count > 0) {
            update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }))?;
        }
    }
    update_channel.send(Ok(IndexingProgress::Finished))?;
    Ok(())
}
