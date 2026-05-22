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
use std::{char, fs, path, path::Path};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Malformed preprocessed content: {0}")]
    MalformedPreprocessed(String),
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
}

// 1449941111000
pub const POSIX_TIMESTAMP_LENGTH: usize = 13;

#[inline]
pub fn is_newline(c: char) -> bool {
    matches!(c, '\x0a' | '\x0d')
}

#[inline]
pub fn number_string_len(linenr: usize) -> usize {
    if linenr == 0 {
        return 1;
    };
    let nr = linenr as f64;
    1 + nr.log10().floor() as usize
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
