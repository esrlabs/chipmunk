use crate::chunks::ChunkFactory;
use crate::parse::*;
use crate::timedline::*;
use crate::utils;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::BinaryHeap;
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::iter::{Iterator, Peekable};
use std::path::{Path, PathBuf};

const REPORT_PROGRESS_LINE_BLOCK: usize = 500_000;

pub struct Merger {
    pub max_lines: usize,  // how many lines to collect before writing out
    pub chunk_size: usize, // used for mapping line numbers to byte positions
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MergeItemOptions {
    name: String,
    offset: Option<i64>,
    year: Option<i32>,
    tag: String,
}

pub fn read_merge_options(f: &mut fs::File) -> Result<Vec<MergeItemOptions>, failure::Error> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)
        .expect("something went wrong reading the file");

    let v: Vec<MergeItemOptions> =
        serde_json::from_str(&contents[..]).expect("could not parse merge item file");
    Ok(v)
}

pub struct MergerInput {
    path: PathBuf,
    offset: Option<i64>,
    year: Option<i32>,
    tag: String,
}

fn file_size(path: &Path) -> u64 {
    let metadata = fs::metadata(path).expect("cannot read size of output file");
    metadata.len()
}
impl Merger {
    pub fn merge_files_use_config_file(
        &self,
        config_path: &PathBuf,
        out_path: &PathBuf,
        append: bool,
        use_stdout: bool,
    ) -> Result<usize, failure::Error> {
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
                tag: o.tag,
            })
            .collect();
        // self.merge_files(inputs, &out_path, append, use_stdout)
        self.merge_files_iter(append, inputs, &out_path, use_stdout)
    }
    #[allow(dead_code)]
    pub fn merge_files(
        &self,
        merger_inputs: Vec<MergerInput>,
        out_path: &PathBuf,
        append: bool,
        to_stdout: bool,
    ) -> Result<usize, failure::Error> {
        let mut heap: BinaryHeap<TimedLine> = BinaryHeap::new();
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

        for input in merger_inputs {
            let kind: RegexKind = detect_timestamp_regex(&input.path)?;
            let r: &Regex = &REGEX_REGISTRY[&kind];
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
                )
                .unwrap_or_else(|_| TimedLine {
                    content: trimmed_line.to_string(),
                    tag: alt_tag.to_string(),
                    timestamp: last_timestamp,
                    original_length: len,
                });
                last_timestamp = timed_line.timestamp;
                heap.push(timed_line);
                buf = vec![];
            }
        }
        let sorted = heap.into_sorted_vec();
        for t in sorted {
            utils::create_tagged_line(&t.tag[..], &mut buf_writer, &t.content[..], line_nr, true)
                .expect("could not create tagged line");
            let trimmed_len = t.content.len();
            let additional_bytes =
                utils::extended_line_length(trimmed_len, t.tag.len(), line_nr, true);
            line_nr += 1;
            if let Some(chunk) = chunk_factory.create_chunk_if_needed(
                line_nr, // TODO avoid passing in this line...error prone
                additional_bytes,
            ) {
                chunks.push(chunk);
            }
        }
        buf_writer.flush()?;
        if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunks.is_empty()) {
            chunks.push(chunk);
        }
        Ok(line_nr)
    }
    #[allow(dead_code)]
    pub fn merge_files_iter(
        &self,
        append: bool,
        merger_inputs: Vec<MergerInput>,
        out_path: &PathBuf,
        to_stdout: bool,
    ) -> Result<usize, failure::Error> {
        let out_file: std::fs::File = if append {
            std::fs::OpenOptions::new()
                .append(true)
                .create(true)
                .open(out_path)?
        } else {
            std::fs::File::create(&out_path)?
        };
        let mut line_nr = if append {
            utils::next_line_nr(&out_path)
                .ok_or_else(|| failure::format_err!("could not get last line number of old file"))?
        } else {
            0
        };
        let original_file_size = out_file.metadata()?.len() as usize;

        let mut chunks = vec![];
        let mut chunk_factory = ChunkFactory::new(self.chunk_size, to_stdout, original_file_size);
        let mut processed_bytes = 0;
        let mut readers: Vec<Peekable<TimedLineIter>> = merger_inputs
            .iter()
            .map(|input| {
                fs::File::open(&input.path)
                    .map_err(failure::Error::from)
                    // .and_then(|f| detect_timestamp_regex(&input.path).map(|r| (f, r)))
                    .and_then(|f| detect_timestamp_regex(&input.path).map(|r| (f, r)))
                    .and_then(|(f, kind)| {
                        let r: &Regex = &REGEX_REGISTRY[&kind];
                        Ok(
                            TimedLineIter::new(f, input.tag.as_str(), r, input.year, input.offset)
                                .peekable(),
                        )
                    })
            })
            .filter_map(Result::ok) // TODO better error handling
            .collect();
        // MergerInput
        let combined_source_file_size = merger_inputs
            .iter()
            .fold(0, |acc, i| acc + file_size(&i.path));

        let mut buf_writer = BufWriter::with_capacity(100 * 1024 * 1024, out_file);
        loop {
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
                }
            }
            if let Some((_, min_index)) = minimum {
                if let Some(line) = readers[min_index].next() {
                    let trimmed_len = line.content.len();
                    if trimmed_len > 0 {
                        processed_bytes += line.original_length;
                        utils::create_tagged_line(
                            &line.tag,
                            &mut buf_writer,
                            &line.content,
                            line_nr,
                            true,
                        )
                        .expect("could not create tagged line");
                        let additional_bytes =
                            utils::extended_line_length(trimmed_len, line.tag.len(), line_nr, true);
                        line_nr += 1;
                        if let Some(chunk) = chunk_factory.create_chunk_if_needed(
                            line_nr, // TODO avoid passing in this line...error prone
                            additional_bytes,
                        ) {
                            chunks.push(chunk);
                            buf_writer.flush()?;
                        }

                        self.report_progress(
                            line_nr,
                            chunk_factory.get_current_byte_index(),
                            processed_bytes,
                            combined_source_file_size as usize,
                        );
                    }
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        // while let Some((i, l)) = readers
        //     .iter_mut()
        //     .filter_map(|i| {
        //         println!("iter over readers");
        //         if let Ok(i) = i {
        //             let line: TimedLine = if let Some(line) = i.peek() {
        //                 println!("iter, line: {:?}", line);
        //                 line.clone()
        //             } else {
        //                 return None;
        //             };
        //             Some((i, line))
        //         } else {
        //             panic!()
        //         }
        //     })
        //     .min_by_key(|(_, s)| (*s).clone())
        // {
        //     i.next();
        //     buf_writer
        //         .write_all(l.content.as_bytes())
        //         .expect("Failed to write");
        //     buf_writer.write_all(&[b'\n']).expect("Failed to write");
        // }
        buf_writer.flush()?;
        if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunks.is_empty()) {
            chunks.push(chunk);
        }
        Ok(line_nr)
    }

    #[inline]
    fn report_progress(
        &self,
        line_nr: usize,
        current_byte_index: usize,
        processed_bytes: usize,
        source_file_size: usize,
    ) {
        if line_nr % REPORT_PROGRESS_LINE_BLOCK == 0 {
            eprintln!(
                "processed {} lines -- byte-index {} ({} %)",
                line_nr,
                current_byte_index,
                (processed_bytes as f32 / source_file_size as f32 * 100.0).round()
            );
        }
    }
}
#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;
    use pretty_assertions::assert_eq;
    use std::fs;
    use tempdir::TempDir;

    test_generator::test_expand_paths! { test_merge_files; "test_samples/merging/*" }

    fn test_merge_files(dir_name: &str) {
        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        let option_path = PathBuf::from(&dir_name).join("config.json");
        let append_to_this = PathBuf::from(&dir_name).join("append_here.log");
        let append_use_case = append_to_this.exists();
        if append_use_case {
            fs::copy(&append_to_this, &out_file_path).expect("copy content failed");
            println!("copied from {:?}", append_to_this);
            let content = fs::read_to_string(append_to_this).expect("could not read file");
            println!("content was: {:?}", content);
            println!("copied content to: {:?}", out_file_path);
            let content2 = fs::read_to_string(&out_file_path).expect("could not read file");
            println!("copied content was: {:?}", content2);
        }

        let merger = Merger {
            max_lines: 5,
            chunk_size: 5,
        };
        let merged_lines_cnt = merger.merge_files_use_config_file(
            &option_path,
            &out_file_path,
            append_use_case,
            false, // use stdout
        );
        println!("merged_lines_cnt: {:?}", merged_lines_cnt);

        let out_file_content_bytes = fs::read(out_file_path).expect("could not read file");
        let out_file_content = String::from_utf8_lossy(&out_file_content_bytes[..]);
        let mut expected_path = PathBuf::from(&dir_name);
        expected_path.push("expected.merged");
        let expected_content_bytes = fs::read(expected_path).expect("could not read expected file");
        let expected_content = String::from_utf8_lossy(&expected_content_bytes[..]);
        println!(
            "comparing\n{}\nto expected:\n{}",
            out_file_content, expected_content
        );
        assert_eq!(expected_content, out_file_content);
    }

    // TODO test files with lines without timestamp
}
