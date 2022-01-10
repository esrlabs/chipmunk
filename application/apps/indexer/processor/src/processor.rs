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

use crate::parse;
use crossbeam_channel as cc;
use encoding_rs_io::*;
use indexer_base::{
    chunks::{ChunkFactory, ChunkResults},
    config::IndexingConfig,
    progress::*,
    utils,
    utils::restore_line,
};
use parse::detect_timestamp_in_string;
use std::{
    fs,
    io::{BufRead, BufReader, BufWriter, Read, Write},
    path::Path,
    time::Instant,
};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum IndexError {
    #[error("Indexing configuration not available: {0}")]
    ConfigurationProblem(String),
    #[error("Indexing failed due to IO problem: {0:?}")]
    IoProblem(#[from] std::io::Error),
    #[error("Processing not possible: {0}")]
    Process(String),
}

pub async fn create_index_and_mapping(
    config: IndexingConfig,
    source_file_size: u64,
    parse_timestamps: bool,
    update_channel: cc::Sender<ChunkResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
) -> Result<(), IndexError> {
    let initial_line_nr =
        utils::next_line_nr(&config.out_path).map_err(|e| IndexError::Process(format!("{}", e)))?;
    let (out_file, current_out_file_size) =
        utils::get_out_file_and_size(config.append, &config.out_path)
            .map_err(|e| IndexError::Process(format!("{}", e)))?;

    let in_file = fs::File::open(&config.in_file).map_err(|e| {
        warn!("could not open {:?}", config.in_file);
        update_channel
            .try_send(Err(Notification {
                severity: Severity::WARNING,
                content: format!("could not open file ({})", e),
                line: None,
            }))
            .expect("UpdateChannel closed");
        IndexError::ConfigurationProblem(format!("could not open file ({})", e))
    })?;
    let mut decode_builder = DecodeReaderBytesBuilder::new();
    decode_builder
        .utf8_passthru(true)
        .strip_bom(true)
        .bom_override(true)
        .bom_sniffing(true);
    let mut decode_buffer = vec![0; 8 * 1024];
    let read_from = decode_builder.build_with_buffer(in_file, &mut *decode_buffer)?;
    index_file(
        read_from,
        &config.tag,
        out_file,
        current_out_file_size,
        config.chunk_size,
        source_file_size,
        initial_line_nr,
        parse_timestamps,
        update_channel,
        shutdown_receiver,
    )
}

#[allow(clippy::too_many_arguments)]
pub fn index_file<T: Read>(
    read_from: T,
    tag: &str,
    out_file: fs::File,
    current_out_file_size: usize,
    chunk_size: usize,
    source_file_size: u64,
    initial_line_nr: usize,
    timestamps: bool,
    update_channel: cc::Sender<ChunkResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
) -> Result<(), IndexError> {
    let start = Instant::now();

    let mut chunk_count = 0usize;
    let mut last_byte_index = 0usize;
    let mut chunk_factory = ChunkFactory::new(chunk_size, current_out_file_size);

    let mut reader = BufReader::new(read_from);
    let mut line_nr = initial_line_nr;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, &out_file);

    let mut buf = vec![];
    let mut stopped = false;

    let mut progress_reporter = ProgressReporter::new(source_file_size, update_channel.clone());
    while let Ok(len) = reader.read_until(b'\n', &mut buf) {
        if stopped {
            info!("we where stopped in indexer",);
            break;
        };
        let s = unsafe { std::str::from_utf8_unchecked(&buf) };
        let trimmed_line = s.trim_matches(utils::is_newline);
        let trimmed_len = trimmed_line.len();
        let had_newline = trimmed_len != len;
        if len == 0 {
            // no more content
            break;
        };
        let ts = if timestamps {
            match detect_timestamp_in_string(trimmed_line, None) {
                Ok((time, _, _)) => Some(time),
                Err(_) => Some(0),
            }
        } else {
            None
        };
        let additional_bytes: usize =
            utils::write_tagged_line(tag, &mut buf_writer, trimmed_line, line_nr, had_newline, ts)?;
        line_nr += 1;

        match chunk_factory.add_bytes(line_nr, additional_bytes) {
            Some(chunk) => {
                stopped = utils::check_if_stop_was_requested(shutdown_receiver.as_ref(), "indexer");
                chunk_count += 1;
                last_byte_index = chunk.b.1;
                update_channel
                    .send(Ok(IndexingProgress::GotItem { item: chunk }))
                    .expect("sending update failed");
                buf_writer.flush()?;
                false
            }
            None => false,
        };

        progress_reporter.make_progress(len);
        buf = vec![];
    }
    if stopped {
        debug!("sending IndexingProgress::Stopped");
        update_channel
            .send(Ok(IndexingProgress::Stopped))
            .expect("could not send update");
        Ok(())
    } else {
        buf_writer.flush()?;
        if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunk_count == 0) {
            last_byte_index = chunk.b.1;
            trace!("index: add last chunk {:?}", chunk);
            update_channel
                .send(Ok(IndexingProgress::GotItem { item: chunk }))
                .expect("could not send update");
            chunk_count += 1;
        }
        if chunk_count > 0 {
            let last_expected_byte_index = out_file.metadata().map(|md| md.len() as usize)?;
            if last_expected_byte_index != last_byte_index {
                return Err(IndexError::Process(format!(
                    "error in computation! last byte in chunks is {} but should be {}",
                    last_byte_index, last_expected_byte_index
                )));
            }
        }
        info!(
            "done, created {} chunks in {} ms, sending Finished",
            chunk_count,
            start.elapsed().as_millis()
        );
        update_channel
            .send(Ok(IndexingProgress::Finished))
            .expect("could not send update");
        Ok(())
    }
}

pub fn restore_original_from_indexed_file(
    indexed_file: &Path,
    out: &Path,
) -> Result<(), IndexError> {
    let f = fs::File::open(&indexed_file)?;
    let reader = &mut std::io::BufReader::new(f);
    let out_file = std::fs::File::create(out)?;
    trace!("created out_file: {:?}", &out_file);
    let mut out_writer = BufWriter::new(out_file);

    let lines_iter = &mut reader.lines();
    for line_res in lines_iter {
        let line = line_res?;
        out_writer.write_fmt(format_args!("{}\n", restore_line(&line)))?;
    }
    Ok(())
}
