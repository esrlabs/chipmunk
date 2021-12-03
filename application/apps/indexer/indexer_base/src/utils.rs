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
use std::{
    char,
    fmt::Display,
    fs,
    io::{self, BufReader, Read, Seek, SeekFrom, Write},
    path,
    path::Path,
    str,
};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Malformed preprocessed content: {0}")]
    MalformedPreprocessed(String),
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
}

pub const ROW_NUMBER_SENTINAL: char = '\u{0002}';
pub const PLUGIN_ID_SENTINAL: char = '\u{0003}';
pub const SENTINAL_LENGTH: usize = 1;
// 1449941111000
pub const POSIX_TIMESTAMP_LENGTH: usize = 13;
const PEEK_END_SIZE: usize = 12;

#[inline]
pub fn is_newline(c: char) -> bool {
    matches!(c, '\x0a' | '\x0d')
}

#[inline]
pub fn restore_line(line: &str) -> &str {
    if let Some(cleaned) = line.split(PLUGIN_ID_SENTINAL).next() {
        cleaned
    } else {
        line
    }
}

#[inline]
pub fn create_tagged_line_d<T: Display>(
    tag: &str,
    out_buffer: &mut io::BufWriter<std::fs::File>,
    trimmed_line: T,
    line_nr: usize,
    with_newline: bool,
) -> io::Result<usize> {
    let bytes_buffered = out_buffer.buffer().len();
    if let Err(e) = out_buffer.write_fmt(format_args!(
        "{}{}{}{}{}{}{}{}",
        trimmed_line, //trimmed_line,
        PLUGIN_ID_SENTINAL,
        tag,
        PLUGIN_ID_SENTINAL,
        ROW_NUMBER_SENTINAL,
        line_nr,
        ROW_NUMBER_SENTINAL,
        if with_newline { "\n" } else { "" },
    )) {
        error!("error happened in create_tagged_line_d!!! {}", e);
    }
    let consumed = out_buffer.buffer().len() - bytes_buffered;
    Ok(consumed)
}

#[inline]
pub fn write_tagged_line<T: io::Write>(
    tag: &str,
    out_buffer: &mut T,
    trimmed_line: &str,
    line_nr: usize,
    with_newline: bool,
    timestamp: Option<i64>,
) -> io::Result<usize> {
    match timestamp {
        Some(ts) => {
            let line_len_with_timestamp_no_nl = trimmed_line.len()
                + 5 * SENTINAL_LENGTH
                + tag.len()
                + number_string_len(line_nr)
                + number_string_len(ts as usize);

            if with_newline {
                writeln!(
                    out_buffer,
                    "{}",
                    format_args!(
                        "{}{}{}{}{}{}{}{}{}",
                        trimmed_line,
                        PLUGIN_ID_SENTINAL,
                        tag,
                        PLUGIN_ID_SENTINAL,
                        ROW_NUMBER_SENTINAL,
                        line_nr,
                        ROW_NUMBER_SENTINAL,
                        ts,
                        ROW_NUMBER_SENTINAL,
                    ),
                )?;
                Ok(line_len_with_timestamp_no_nl + 1)
            } else {
                write!(
                    out_buffer,
                    "{}",
                    format_args!(
                        "{}{}{}{}{}{}{}{}{}",
                        trimmed_line,
                        PLUGIN_ID_SENTINAL,
                        tag,
                        PLUGIN_ID_SENTINAL,
                        ROW_NUMBER_SENTINAL,
                        line_nr,
                        ROW_NUMBER_SENTINAL,
                        ts,
                        ROW_NUMBER_SENTINAL,
                    ),
                )?;
                Ok(line_len_with_timestamp_no_nl)
            }
        }
        None => {
            let line_len_no_timestamp_no_nl =
                trimmed_line.len() + 4 * SENTINAL_LENGTH + tag.len() + number_string_len(line_nr);
            if with_newline {
                writeln!(
                    out_buffer,
                    "{}",
                    format_args!(
                        "{}{}{}{}{}{}{}",
                        trimmed_line,
                        PLUGIN_ID_SENTINAL,
                        tag,
                        PLUGIN_ID_SENTINAL,
                        ROW_NUMBER_SENTINAL,
                        line_nr,
                        ROW_NUMBER_SENTINAL,
                    ),
                )?;
                Ok(line_len_no_timestamp_no_nl + 1)
            } else {
                write!(
                    out_buffer,
                    "{}",
                    format_args!(
                        "{}{}{}{}{}{}{}",
                        trimmed_line,
                        PLUGIN_ID_SENTINAL,
                        tag,
                        PLUGIN_ID_SENTINAL,
                        ROW_NUMBER_SENTINAL,
                        line_nr,
                        ROW_NUMBER_SENTINAL,
                    ),
                )?;
                Ok(line_len_no_timestamp_no_nl)
            }
        }
    }
}

pub fn number_string_len(linenr: usize) -> usize {
    if linenr == 0 {
        return 1;
    };
    let nr = linenr as f64;
    1 + nr.log10().floor() as usize
}

/// extract the line number from a chipmunk preprocessed (indexed) file
/// and use it to calculate the next index
/// for continuing the indexed list of log messages
pub fn next_line_nr(path: &std::path::Path) -> Result<usize, Error> {
    if !path.exists() {
        return Ok(0);
    }
    let file = fs::File::open(path)?;
    let file_size = file.metadata()?.len();
    if file_size == 0 {
        return Ok(0);
    };
    let mut reader = BufReader::new(file);
    let seek_offset: i64 = -(std::cmp::min(file_size - 1, PEEK_END_SIZE as u64) as i64);
    match reader.seek(SeekFrom::End(seek_offset as i64)) {
        Ok(_) => (),
        Err(e) => {
            return Err(Error::MalformedPreprocessed(format!(
                "Could not read last entry in file {:?}",
                e
            )));
        }
    };
    let size_of_slice = seek_offset.abs() as usize;
    let mut buf: Vec<u8> = vec![0; size_of_slice];
    reader.read_exact(&mut buf)?;
    // |tag|#row#\n
    for i in 0..size_of_slice - 1 {
        if buf[i] == (PLUGIN_ID_SENTINAL as u8) && buf[i + 1] == ROW_NUMBER_SENTINAL as u8 {
            // row nr starts at i + 2
            let row_slice = &buf[i + 2..];
            let row_string = std::str::from_utf8(row_slice).map_err(|e| {
                Error::MalformedPreprocessed(format!("Could not convert slice from utf8: {}", e))
            })?;
            let row_nr: usize = row_string
                .trim_end_matches(is_newline)
                .trim_end_matches(ROW_NUMBER_SENTINAL)
                .parse()
                .map_err(|e| {
                    Error::MalformedPreprocessed(format!("Extract row number failed: {}", e))
                })?;
            return Ok(row_nr + 1);
        }
    }
    Err(Error::MalformedPreprocessed(format!(
        "did not find row number in line: {:X?}",
        buf
    )))
}
pub fn get_out_file_and_size(
    append: bool,
    out_path: &path::Path,
) -> Result<(fs::File, usize), Error> {
    let out_file: std::fs::File = if append {
        std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(out_path)?
    } else {
        std::fs::File::create(out_path)?
    };
    let current_out_file_size = out_file.metadata().map(|md| md.len() as usize)?;
    Ok((out_file, current_out_file_size))
}

pub fn get_processed_bytes(append: bool, out: &Path) -> u64 {
    if append {
        match fs::metadata(out) {
            Ok(metadata) => metadata.len(),
            Err(_) => 0,
        }
    } else {
        0
    }
}

pub fn check_if_stop_was_requested(
    shutdown_receiver: Option<&crossbeam_channel::Receiver<()>>,
    component: &str,
) -> bool {
    match shutdown_receiver.as_ref() {
        Some(rx) => match rx.try_recv() {
            // Shutdown if we have received a command or if there is
            // nothing to send it.
            Ok(_) | Err(cc::TryRecvError::Disconnected) => {
                info!("shutdown received in {}", component);
                true // stop
            }
            // No shutdown command, continue
            Err(cc::TryRecvError::Empty) => false,
        },
        None => false,
    }
}
