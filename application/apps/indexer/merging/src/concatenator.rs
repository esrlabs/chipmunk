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
use crate::merger::combined_file_size;
use crossbeam_channel as cc;
use indexer_base::{
    chunks::{ChunkFactory, ChunkResults},
    progress::{IndexingProgress, ProgressReporter},
    utils,
};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{BufRead, BufReader, BufWriter, Read, Write},
    iter::Iterator,
    path::{Path, PathBuf},
};
use thiserror::Error;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Error)]
pub enum ConcatError {
    #[error("Concat configuration seems to be broken: {0}")]
    WrongConfiguration(String),
    #[error("Concatenation not possible: {0:?}")]
    IoProblem(#[from] std::io::Error),
    #[error("JSON possible: {0:?}")]
    JsonProblem(#[from] serde_json::Error),
    #[error("General concatenation error: {0}")]
    General(String),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ConcatItemOptions {
    path: String,
    tag: String,
}

pub fn read_concat_options(f: &mut fs::File) -> Result<Vec<ConcatItemOptions>, ConcatError> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)?;

    let v: Vec<ConcatItemOptions> = serde_json::from_str(&contents[..])?;
    Ok(v)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConcatenatorInput {
    pub path: String,
    pub tag: String,
}
#[derive(Serialize, Deserialize, Debug)]
pub struct ConcatenatorResult {
    pub file_cnt: usize,
    pub line_cnt: usize,
    pub byte_cnt: usize,
}
