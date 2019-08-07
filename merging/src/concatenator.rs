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
use indexer_base::utils;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::iter::{Iterator};
use std::path::{Path, PathBuf};

const REPORT_PROGRESS_LINE_BLOCK: usize = 500_000;

pub struct Concatenator {
    pub chunk_size: usize, // used for mapping line numbers to byte positions
}

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

pub struct ConcatenatorInput {
    path: PathBuf,
    tag: String,
}
fn file_size(path: &Path) -> u64 {
    let metadata = fs::metadata(path).expect("cannot read size of output file");
    metadata.len()
}
impl Concatenator {
    pub fn concat_files_use_config_file(
        &self,
        config_path: &PathBuf,
        out_path: &PathBuf,
        append: bool,
        use_stdout: bool,
        report_status: bool,
    ) -> Result<usize, failure::Error> {
        let mut concat_option_file = fs::File::open(config_path)?;
        let dir_name = config_path
            .parent()
            .ok_or_else(|| failure::err_msg("could not find directory of config file"))?;
        let options: Vec<ConcatItemOptions> = read_concat_options(&mut concat_option_file)?;
        let inputs: Vec<ConcatenatorInput> = options
            .into_iter()
            .map(|o: ConcatItemOptions| ConcatenatorInput {
                path: PathBuf::from(&dir_name).join(o.path),
                tag: o.tag,
            })
            .collect();
        self.concat_and_sort_files(inputs, &out_path, use_stdout, append, report_status)
    }
    #[allow(dead_code)]
    pub fn concat_and_sort_files(
        &self,
        concat_inputs: Vec<ConcatenatorInput>,
        out_path: &PathBuf,
        report_status: bool,
        append: bool,
        to_stdout: bool,
    ) -> Result<usize, failure::Error> {
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
        let mut processed_bytes = 0;

        let combined_source_file_size = concat_inputs
            .iter()
            .fold(0, |acc, i| acc + file_size(&i.path));
        for input in concat_inputs {
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

                let additional_bytes = utils::create_tagged_line(
                    &input.tag[..],
                    &mut buf_writer,
                    trimmed_line,
                    line_nr,
                    true,
                )?;
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
                buf = vec![];
            }
        }
        buf_writer.flush()?;
        if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunks.is_empty()) {
            chunks.push(chunk);
        }
        Ok(line_nr)
    }
}
