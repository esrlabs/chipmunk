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
use failure::err_msg;
use indexer_base::progress::{IndexingProgress, IndexingResults};
use indexer_base::utils;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::iter::Iterator;
use std::path::PathBuf;
use std::sync::mpsc::{self, TryRecvError};

#[derive(Serialize, Deserialize, Debug)]
pub struct ConcatItemOptions {
    path: String,
    tag: String,
}

pub fn read_concat_options(f: &mut fs::File) -> Result<Vec<ConcatItemOptions>, failure::Error> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)
        .expect("something went wrong reading the file");

    let v: Vec<ConcatItemOptions> = serde_json::from_str(&contents[..])?; //.expect("could not parse concat item file");
    Ok(v)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ConcatenatorInput {
    path: String,
    tag: String,
}
#[derive(Serialize, Deserialize, Debug)]
pub struct ConcatenatorResult {
    pub file_cnt: usize,
    pub line_cnt: usize,
    pub byte_cnt: usize,
}
pub fn concat_files_use_config_file(
    config_path: &PathBuf,
    out_path: &PathBuf,
    append: bool,
    update_channel: mpsc::Sender<IndexingResults<ConcatenatorResult>>,
    shutdown_rx: Option<mpsc::Receiver<()>>,
) -> Result<(), failure::Error> {
    let mut concat_option_file = fs::File::open(config_path)?;
    let dir_name = config_path
        .parent()
        .ok_or_else(|| failure::err_msg("could not find directory of config file"))?;
    let options: Vec<ConcatItemOptions> = read_concat_options(&mut concat_option_file)?;
    let inputs: Vec<ConcatenatorInput> = options
        .into_iter()
        .map(|o: ConcatItemOptions| ConcatenatorInput {
            path: PathBuf::from(&dir_name)
                .join(o.path)
                .to_str()
                .unwrap()
                .to_string(),
            tag: o.tag,
        })
        .collect();
    concat_files(inputs, &out_path, append, update_channel, shutdown_rx)
}
pub fn concat_files(
    concat_inputs: Vec<ConcatenatorInput>,
    out_path: &PathBuf,
    append: bool,
    update_channel: mpsc::Sender<IndexingResults<ConcatenatorResult>>,
    shutdown_rx: Option<mpsc::Receiver<()>>,
) -> Result<(), failure::Error> {
    let file_cnt = concat_inputs.len();
    trace!("concat_files called with {} files", file_cnt);
    let mut line_nr = 0;
    let out_file: std::fs::File = if append {
        std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(out_path)?
    } else {
        std::fs::File::create(&out_path).unwrap()
    };
    let mut buf_writer = BufWriter::with_capacity(10 * 1024 * 1024, out_file);
    let mut processed_bytes = 0;

    let combined_source_file_size = concat_inputs.iter().try_fold(0, |acc, i| {
        let f = &PathBuf::from(i.path.clone());
        match fs::metadata(f) {
            Ok(metadata) => Ok(acc + metadata.len()),
            Err(e) => Err(err_msg(format!(
                "error getting size of file {:?} ({})",
                f, e
            ))),
        }
    })?;
    let mut progress_percentage = 0usize;
    for input in concat_inputs {
        if let Some(rx) = shutdown_rx.as_ref() {
            match rx.try_recv() {
                Ok(_) | Err(TryRecvError::Disconnected) => {
                    info!("shutdown received in concatenator",);
                    update_channel.send(Ok(IndexingProgress::Stopped))?;
                    return Ok(());
                }
                // No shutdown command, continue
                _ => (),
            }
        };
        let f: fs::File = fs::File::open(input.path)?;
        let mut reader: BufReader<&std::fs::File> = BufReader::new(&f);
        let mut buf = vec![];
        while let Ok(len) = reader.read_until(b'\n', &mut buf) {
            if len == 0 {
                // no more content
                break;
            };
            let original_line_length = len;
            processed_bytes += original_line_length;
            let s = unsafe { std::str::from_utf8_unchecked(&buf) };
            let trimmed_line = s.trim_matches(utils::is_newline);

            let _additional_bytes = utils::create_tagged_line(
                &input.tag[..],
                &mut buf_writer,
                trimmed_line,
                line_nr,
                true,
            )?;
            line_nr += 1;

            let new_progress_percentage: usize =
                (processed_bytes as f64 / combined_source_file_size as f64 * 10.0).round() as usize;
            if new_progress_percentage != progress_percentage {
                progress_percentage = new_progress_percentage;
                let _ = update_channel.send(Ok(IndexingProgress::Progress {
                    ticks: (processed_bytes, combined_source_file_size as usize),
                }));
            }
            buf = vec![];
        }
    }
    buf_writer.flush()?;

    let _ = update_channel.send(Ok(IndexingProgress::Progress {
        ticks: (processed_bytes, combined_source_file_size as usize),
    }));
    let _ = update_channel.send(Ok(IndexingProgress::GotItem {
        item: ConcatenatorResult {
            file_cnt,
            line_cnt: line_nr,
            byte_cnt: processed_bytes,
        },
    }));

    let _ = update_channel.send(Ok(IndexingProgress::Finished));
    Ok(())
}
