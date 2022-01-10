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
pub fn concat_files_use_config_file(
    files: Vec<ConcatenatorInput>,
    out_path: &Path,
    append: bool,
    chunk_size: usize, // used for mapping line numbers to byte positions
    update_channel: cc::Sender<ChunkResults>,
    shutdown_token: Option<CancellationToken>,
) -> Result<(), ConcatError> {
    concat_files(
        files,
        out_path,
        append,
        chunk_size,
        update_channel,
        shutdown_token,
    )
}
pub fn concat_files(
    concat_inputs: Vec<ConcatenatorInput>,
    out_path: &Path,
    append: bool,
    chunk_size: usize, // used for mapping line numbers to byte positions
    update_channel: cc::Sender<ChunkResults>,
    shutdown_token: Option<CancellationToken>,
) -> Result<(), ConcatError> {
    let file_cnt = concat_inputs.len();
    trace!("concat_files called with {} files", file_cnt);
    let mut line_nr = 0;
    let out_file: std::fs::File = if append {
        std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(out_path)?
    } else {
        std::fs::File::create(&out_path)?
    };
    let original_file_size = out_file.metadata()?.len() as usize;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
    let mut chunk_factory = ChunkFactory::new(chunk_size, original_file_size);
    let mut chunk_count = 0usize;
    let paths: Vec<PathBuf> = concat_inputs
        .iter()
        .map(|x| PathBuf::from(x.path.clone()))
        .collect();
    let mut progress_reporter = ProgressReporter::new(
        combined_file_size(&paths).map_err(|e| ConcatError::General(format!("{:?}", e)))?,
        update_channel.clone(),
    );

    for input in concat_inputs {
        if let Some(shutdown_token) = shutdown_token.as_ref() {
            if shutdown_token.is_cancelled() {
                update_channel
                    .send(Ok(IndexingProgress::Stopped))
                    .expect("Sending progress must work");
                return Ok(());
            }
        }
        let f: fs::File = fs::File::open(input.path)?;
        let mut reader: BufReader<&std::fs::File> = BufReader::new(&f);
        let mut buf = vec![];
        while let Ok(len) = reader.read_until(b'\n', &mut buf) {
            if len == 0 {
                // no more content
                break;
            };
            let original_line_length = len;
            let s = unsafe { std::str::from_utf8_unchecked(&buf) };
            let trimmed_line = s.trim_matches(utils::is_newline);

            let additional_bytes = utils::write_tagged_line(
                &input.tag[..],
                &mut buf_writer,
                trimmed_line,
                line_nr,
                true,
                None,
            )?;
            line_nr += 1;
            if let Some(chunk) = chunk_factory.add_bytes(
                line_nr, // TODO avoid passing in this line...error prone
                additional_bytes,
            ) {
                // check if stop was requested
                chunk_count += 1;
                buf_writer.flush()?;
                update_channel
                    .send(Ok(IndexingProgress::GotItem { item: chunk }))
                    .expect("Sending item must work");
            }

            progress_reporter.make_progress(original_line_length);
            buf = vec![];
        }
    }
    buf_writer.flush()?;
    if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunk_count > 0) {
        update_channel
            .send(Ok(IndexingProgress::GotItem { item: chunk }))
            .expect("Sending item must work");
    }

    update_channel
        .send(Ok(IndexingProgress::Finished))
        .expect("UpdateChannel closed");
    Ok(())
}
