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
use anyhow::{anyhow, Result};
use crossbeam_channel as cc;
use indexer_base::{
    chunks::{Chunk, ChunkFactory, ChunkResults},
    error_reporter::*,
    progress::{IndexingProgress, ProgressReporter},
    timedline::*,
    utils,
};
use processor::parse::{line_to_timed_line, lookup_regex_for_format_str};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    fmt::Debug,
    fs::{self, File},
    io::{BufRead, BufReader, BufWriter, Read, Write},
    iter::{Iterator, Peekable},
    path::{Path, PathBuf},
};

#[derive(Serialize, Deserialize, Debug)]
pub struct FileMergeOptions {
    /// Path to the file to merge
    pub path: String,
    /// Offset in ms, this will be added to each posix timestamp
    pub offset: Option<i64>,
    /// If a year is provided and if no year was detected, this is what we use
    pub year: Option<i32>,
    /// An identifier string for the file
    pub tag: String,
    /// how we interpret the date string in each line
    pub format: String,
}

pub fn read_merge_options(
    f: &mut File,
    relative_path: Option<impl AsRef<Path>>,
) -> Result<Vec<FileMergeOptions>> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)?;

    let v: Vec<FileMergeOptions> = serde_json::from_str(&contents[..])?;
    match relative_path {
        Some(relative) => Ok(v
            .into_iter()
            .map(|option| FileMergeOptions {
                path: relative.as_ref().join(option.path).to_string_lossy().into(),
                ..option
            })
            .collect()),
        None => Ok(v),
    }
}

#[allow(dead_code)]
pub struct FileLogEntryProducer {
    timed_line_iterator: TimedLineIter,
}
#[allow(dead_code)]
impl FileLogEntryProducer {
    pub(crate) fn new(
        read_from: File,
        tag: String,
        regex: Regex,
        year: Option<i32>,
        time_offset: Option<i64>,
        current_line_nr: usize,
    ) -> Result<FileLogEntryProducer> {
        let iter = TimedLineIter::new(read_from, tag, regex, year, time_offset, current_line_nr);
        Ok(FileLogEntryProducer {
            timed_line_iterator: iter,
        })
    }
}

impl futures::Stream for FileLogEntryProducer {
    type Item = Result<Option<TimedLine>>;
    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context,
    ) -> futures::task::Poll<Option<Self::Item>> {
        let next = self.timed_line_iterator.next();
        match next {
            Some(msg) => futures::task::Poll::Ready(Some(Ok(Some(msg)))),
            None => futures::task::Poll::Ready(Some(Err(anyhow!("no more message")))),
        }
    }
}

pub struct TimedLineIter {
    reader: BufReader<File>,
    tag: String,
    regex: Regex,
    year: Option<i32>,
    time_offset: Option<i64>,
    last_timestamp: i64,
    pub current_line_nr: usize,
    reporter: Reporter,
}
impl TimedLineIter {
    pub fn new(
        read_from: File,
        tag: String,
        regex: Regex,
        year: Option<i32>,
        time_offset: Option<i64>,
        current_line_nr: usize,
    ) -> TimedLineIter {
        trace!("create TimedLineIter for {:?}", read_from);
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
impl Iterator for TimedLineIter {
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
                    &self.tag,
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
            Err(e) => {
                warn!("error iterating: {}", e);
                None
            }
        }
    }
}

/// Merge files.
///
/// merge all files so that the resulting file contains the log entries in the correct timely order
/// this function takes a list of `FileMergeOptions` which contains the file path together with
/// the date format that was detected or specified for the file. Each enty also can contain an offest in ms
/// that will be added/subtracted from each detected timestamp.
///
/// As a result, updates of the progress are reported through the `update_channel`
/// when finished, the resulting output file is stored in `out_path`
///
pub fn merge_files_use_config(
    options: Vec<FileMergeOptions>,
    out_path: &Path,
    append: bool,
    chunk_size: usize, // used for mapping line numbers to byte positions
    update_channel: cc::Sender<ChunkResults>,
    shutdown_rx: Option<cc::Receiver<()>>,
) -> Result<()> {
    trace!("merge {} files", options.len());
    do_the_merge(
        append,
        &out_path,
        chunk_size,
        options,
        update_channel,
        shutdown_rx.as_ref(),
    )
}

/// Merge files using a config file
///
/// Convenience function that enables specifing a file that contains the merge-configuration
/// important: when using this version of the merge function, the relative path to the config
/// file is considered and prependend to the file paths in the config file
///
pub fn merge_files_use_config_file(
    config_path: &Path,
    out_path: &Path,
    append: bool,
    chunk_size: usize, // used for mapping line numbers to byte positions
    update_channel: cc::Sender<ChunkResults>,
    shutdown_rx: Option<cc::Receiver<()>>,
) -> Result<()> {
    trace!("merge files using config from {}", config_path.display());
    let mut merge_option_file = File::open(config_path)?;
    let options: Vec<FileMergeOptions> =
        read_merge_options(&mut merge_option_file, config_path.parent())?;
    trace!("with options...");
    do_the_merge(
        append,
        &out_path,
        chunk_size,
        options,
        update_channel,
        shutdown_rx.as_ref(),
    )
}

fn do_the_merge(
    append: bool,
    out_path: &Path,
    chunk_size: usize,
    merger_inputs: Vec<FileMergeOptions>,
    update_channel: cc::Sender<ChunkResults>,
    shutdown_rx: Option<&cc::Receiver<()>>,
) -> Result<()> {
    let mut writer = IndexOutput::new(
        append,
        out_path,
        chunk_size,
        combined_file_size(&merger_inputs)?,
        update_channel.clone(),
    )?;
    trace!("calling merge_inputs_with_writer");
    merge_inputs_with_writer(&mut writer, merger_inputs, update_channel, shutdown_rx)
}

pub trait Len {
    fn len(&self) -> Result<u64>;
    fn is_empty(self: &Self) -> bool;
}

impl Len for FileMergeOptions {
    fn len(&self) -> Result<u64> {
        Ok(fs::metadata(&self.path)?.len())
    }

    fn is_empty(self: &Self) -> bool {
        match self.len() {
            Ok(0) => true,
            _ => false,
        }
    }
}
impl Len for PathBuf {
    fn len(&self) -> Result<u64> {
        Ok(fs::metadata(self)?.len())
    }
    fn is_empty(self: &Self) -> bool {
        match self.len() {
            Ok(0) => true,
            _ => false,
        }
    }
}

pub trait TimedLogEntry: PartialOrd {
    fn get_timestamp() -> Option<i64>;
    fn year_missing() -> bool;
}

// impl PartialOrd for TimedLogEntry {
//     fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
//         Some(self.get_timestamp().cmp(&other.get_timestamp()))
//     }
// }

// impl TimedLogEntry for TimedLine {}
// // Box<&dyn TimedLineIter> as Box<&dyn Iterator<Item = TimedLogEntry>>
// // 1.TimedLine
// // 2.DltRecord

// pub(crate) fn merge_inputs_with_writer<T: Read>(
//     writer: &mut IndexOutput,
//     merger_inputs: Vec<impl Iterator<Item = TimedLogEntry>>,
//     update_channel: cc::Sender<ChunkResults>,
//     shutdown_rx: Option<&cc::Receiver<()>>,
// ) -> Result<()> {

pub(crate) fn merge_inputs_with_writer(
    writer: &mut IndexOutput,
    merger_inputs: Vec<FileMergeOptions>,
    update_channel: cc::Sender<ChunkResults>,
    shutdown_rx: Option<&cc::Receiver<()>>,
) -> Result<()> {
    trace!("merge_inputs_with_writer ({} files)", merger_inputs.len());
    let mut lines_with_year_missing = 0usize;
    // create a peekable iterator for all file inputs
    let mut readers: Vec<Peekable<TimedLineIter>> = merger_inputs
        .into_iter()
        .map(
            |input: FileMergeOptions| -> Result<Peekable<TimedLineIter>> {
                let file_path = PathBuf::from(input.path);
                let absolute_path = file_path;
                //     Some(dir) if !file_path.is_absolute() => PathBuf::from(&dir).join(file_path),
                //     _ => file_path,
                // };
                trace!("absolute_path was: {:?}", absolute_path);
                Ok(TimedLineIter::new(
                    File::open(absolute_path)?,
                    input.tag,
                    lookup_regex_for_format_str(&input.format)?,
                    input.year,
                    input.offset,
                    writer.line_nr,
                )
                .peekable())
            },
        )
        .filter_map(Result::ok) // TODO better error handling
        .collect();
    let mut stopped = false;
    loop {
        if stopped {
            info!("we where stopped while merging");
            break;
        }
        // keep track of the min timestamp together with the index of the file it belongs to
        // to do this, we peek an entry of each reader and of all those entries we
        // find the minimum timestamp entry
        let mut minimum: Option<(i64, usize)> = None;
        for (i, iter) in readers.iter_mut().enumerate() {
            if let Some(entry) = iter.peek() {
                match minimum {
                    Some((t_min, _)) => {
                        if entry.timestamp < t_min {
                            minimum = Some((entry.timestamp, i));
                        }
                    }
                    None => {
                        minimum = Some((entry.timestamp, i));
                    }
                }
                if entry.year_was_missing {
                    lines_with_year_missing += 1
                }
            }
        }
        if let Some((_, min_index)) = minimum {
            // we found an entry with a minimal timestamp
            if let Some(line) = readers[min_index].next() {
                // important: keep track of how many bytes we processed
                let trimmed_len = line.content.len();
                if trimmed_len > 0 {
                    writer.add_to_chunk(&line.content, &line.tag, line.original_length)?;
                    stopped = utils::check_if_stop_was_requested(shutdown_rx, "merger");
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
        writer.write_rest()?;
    }
    update_channel.send(Ok(IndexingProgress::Finished))?;
    Ok(())
}

pub struct IndexOutput {
    pub(crate) line_nr: usize,
    update_channel: cc::Sender<ChunkResults>,
    chunk_count: usize,
    chunk_factory: ChunkFactory,
    buf_writer: BufWriter<File>,
    progress_reporter: ProgressReporter<Chunk>,
}

pub(crate) fn combined_file_size<T>(paths: &[T]) -> Result<u64>
where
    T: Len + Debug,
{
    paths.iter().try_fold(0, |acc, x| match x.len() {
        Ok(len) => Ok(acc + len as u64),
        Err(e) => Err(anyhow!("error getting combined file size ({})", e)),
    })
}

impl IndexOutput {
    fn new(
        append: bool,
        out_path: &Path,
        chunk_size: usize,
        combined_size: u64,
        update_channel: cc::Sender<ChunkResults>,
    ) -> Result<Self> {
        let out_file: File = if append {
            std::fs::OpenOptions::new()
                .append(true)
                .create(true)
                .open(out_path)?
        } else {
            File::create(&out_path)?
        };
        let line_nr = if append {
            utils::next_line_nr(&out_path)?
        } else {
            0
        };
        let original_file_size = out_file.metadata()?.len() as usize;
        let buf_writer = BufWriter::with_capacity(100 * 1024 * 1024, out_file);

        let progress_reporter = ProgressReporter::new(combined_size, update_channel.clone());
        Ok(IndexOutput {
            line_nr,
            update_channel,
            chunk_factory: ChunkFactory::new(chunk_size, original_file_size),
            chunk_count: 0usize,
            buf_writer,
            progress_reporter,
        })
    }

    pub(crate) fn add_to_chunk(
        &mut self,
        content: &str,
        tag: &str,
        original_len: usize,
    ) -> Result<()> {
        let additional_bytes = utils::write_tagged_line(
            &tag,
            &mut self.buf_writer,
            &content,
            self.line_nr,
            true,
            None,
        )?;
        self.line_nr += 1;
        self.progress_reporter.make_progress(original_len);
        if let Some(chunk) = self.chunk_factory.add_bytes(
            self.line_nr, // TODO avoid passing in this line...error prone
            additional_bytes,
        ) {
            self.chunk_count += 1;
            self.buf_writer.flush()?;
            self.update_channel
                .send(Ok(IndexingProgress::GotItem { item: chunk }))?;
        }
        Ok(())
    }
    pub(crate) fn write_rest(&mut self) -> Result<()> {
        self.buf_writer.flush()?;
        if let Some(chunk) = self
            .chunk_factory
            .create_last_chunk(self.line_nr, self.chunk_count > 0)
        {
            self.update_channel
                .send(Ok(IndexingProgress::GotItem { item: chunk }))?;
        }
        Ok(())
    }
}
