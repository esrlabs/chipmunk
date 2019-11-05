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

use indexer_base::chunks::ChunkResults;
use crate::parse;
use failure::{err_msg, Error};
use indexer_base::chunks::{ChunkFactory};
use indexer_base::config::IndexingConfig;
use indexer_base::progress::*;
use indexer_base::utils;
use parse::detect_timestamp_in_string;
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::sync::mpsc::{self, TryRecvError};
use std::time::Instant;

pub fn create_index_and_mapping(
    config: IndexingConfig,
    parse_timestamps: bool,
    source_file_size: Option<usize>,
    update_channel: mpsc::Sender<ChunkResults>,
    shutdown_receiver: Option<mpsc::Receiver<()>>,
) -> Result<(), Error> {
    let initial_line_nr = match utils::next_line_nr(config.out_path) {
        Ok(nr) => nr,
        Err(e) => {
            let c = format!(
                "could not determine last line number of {:?} ({})",
                config.out_path, e
            );
            let _ = update_channel.send(Err(Notification {
                severity: Severity::ERROR,
                content: c.clone(),
                line: None,
            }));
            return Err(err_msg(c));
        }
    };
    index_file(
        config,
        initial_line_nr,
        parse_timestamps,
        source_file_size,
        update_channel,
        shutdown_receiver,
        // report,
    )
}

pub fn index_file(
    config: IndexingConfig,
    initial_line_nr: usize,
    timestamps: bool,
    source_file_size: Option<usize>,
    update_channel: mpsc::Sender<ChunkResults>,
    shutdown_receiver: Option<mpsc::Receiver<()>>,
) -> Result<(), Error> {
    trace!("called index_file for file: {:?}", config.in_file);
    let start = Instant::now();
    let (out_file, current_out_file_size) =
        utils::get_out_file_and_size(config.append, &config.out_path)?;

    let mut chunk_count = 0usize;
    let mut last_byte_index = 0usize;
    let mut chunk_factory =
        ChunkFactory::new(config.chunk_size, config.to_stdout, current_out_file_size);

    let mut reader = BufReader::new(config.in_file);
    let mut line_nr = initial_line_nr;
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);

    let mut buf = vec![];
    let mut processed_bytes = 0usize;
    let mut progress_percentage = 0usize;
    let mut stopped = false;
    while let Ok(len) = reader.read_until(b'\n', &mut buf) {
        if stopped {
            info!("we where stopped in indexer",);
            break;
        };
        let s = unsafe { std::str::from_utf8_unchecked(&buf) };
        let trimmed_line = s.trim_matches(utils::is_newline);
        let trimmed_len = trimmed_line.len();
        let had_newline = trimmed_len != len;
        processed_bytes += len;
        if len == 0 {
            // no more content
            break;
        };
        let additional_bytes: usize;
        // only use non-empty lines, others will be dropped
        if trimmed_len != 0 {
            if timestamps {
                let ts = match detect_timestamp_in_string(trimmed_line, None) {
                    Ok((time, _, _)) => time,
                    Err(_) => 0,
                };
                if had_newline {
                    writeln!(
                        buf_writer,
                        "{}{}{}{}{}{}{}{}{}",
                        trimmed_line,
                        utils::PLUGIN_ID_SENTINAL,
                        config.tag,
                        utils::PLUGIN_ID_SENTINAL,
                        utils::ROW_NUMBER_SENTINAL,
                        line_nr,
                        utils::ROW_NUMBER_SENTINAL,
                        ts,
                        utils::ROW_NUMBER_SENTINAL,
                    )?;
                } else {
                    write!(
                        buf_writer,
                        "{}{}{}{}{}{}{}{}{}",
                        trimmed_line,
                        utils::PLUGIN_ID_SENTINAL,
                        config.tag,
                        utils::PLUGIN_ID_SENTINAL,
                        utils::ROW_NUMBER_SENTINAL,
                        line_nr,
                        utils::ROW_NUMBER_SENTINAL,
                        ts,
                        utils::ROW_NUMBER_SENTINAL,
                    )?;
                }
                additional_bytes = utils::extended_line_length(
                    trimmed_len,
                    config.tag.len(),
                    line_nr,
                    had_newline,
                ) + utils::linenr_length(ts as usize)
                    + 1;
            } else {
                if had_newline {
                    writeln!(
                        buf_writer,
                        "{}{}{}{}{}{}{}",
                        trimmed_line,
                        utils::PLUGIN_ID_SENTINAL,
                        config.tag,
                        utils::PLUGIN_ID_SENTINAL,
                        utils::ROW_NUMBER_SENTINAL,
                        line_nr,
                        utils::ROW_NUMBER_SENTINAL,
                    )?;
                } else {
                    write!(
                        buf_writer,
                        "{}{}{}{}{}{}{}",
                        trimmed_line,
                        utils::PLUGIN_ID_SENTINAL,
                        config.tag,
                        utils::PLUGIN_ID_SENTINAL,
                        utils::ROW_NUMBER_SENTINAL,
                        line_nr,
                        utils::ROW_NUMBER_SENTINAL,
                    )?;
                }
                additional_bytes = utils::extended_line_length(
                    trimmed_len,
                    config.tag.len(),
                    line_nr,
                    had_newline,
                );
            }
            line_nr += 1;

            match chunk_factory.create_chunk_if_needed(line_nr, additional_bytes) {
                Some(chunk) => {
                    // check if stop was requested
                    if let Some(rx) = shutdown_receiver.as_ref() {
                        match rx.try_recv() {
                            // Shutdown if we have received a command or if there is
                            // nothing to send it.
                            Ok(_) | Err(TryRecvError::Disconnected) => {
                                info!("shutdown received in indexer",);
                                stopped = true // stop
                            }
                            // No shutdown command, continue
                            Err(TryRecvError::Empty) => (),
                        }
                    };
                    chunk_count += 1;
                    last_byte_index = chunk.b.1;
                    update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }))?;
                    buf_writer.flush()?;
                    false
                }
                None => false,
            };

            if let Some(file_size) = source_file_size {
                let new_progress_percentage: usize =
                    (processed_bytes as f64 / file_size as f64 * 100.0).round() as usize;
                if new_progress_percentage != progress_percentage {
                    progress_percentage = new_progress_percentage;
                    update_channel.send(Ok(IndexingProgress::Progress {
                        ticks: (processed_bytes, file_size),
                    }))?;
                }
            }
        }
        buf = vec![];
    }
    if stopped {
        debug!("sending IndexingProgress::Stopped");
        update_channel.send(Ok(IndexingProgress::Stopped))?;
        Ok(())
    } else {
        buf_writer.flush()?;
        if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunk_count == 0) {
            last_byte_index = chunk.b.1;
            trace!("index: add last chunk {:?}", chunk);
            update_channel.send(Ok(IndexingProgress::GotItem { item: chunk }))?;
            chunk_count += 1;
        }
        if chunk_count > 0 {
            let last_expected_byte_index =
                fs::metadata(config.out_path).map(|md| md.len() as usize)?;
            if last_expected_byte_index != last_byte_index {
                return Err(err_msg(format!(
                    "error in computation! last byte in chunks is {} but should be {}",
                    last_byte_index, last_expected_byte_index
                )));
            }
        }
        let elapsed = start.elapsed();
        let ms = elapsed.as_millis();
        info!(
            "done, created {} chunks in {} ms, sending Finished",
            chunk_count, ms
        );
        update_channel.send(Ok(IndexingProgress::Finished))?;
        Ok(())
    }
}
