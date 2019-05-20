use crate::chunks::{Chunk, ChunkFactory};
use crate::utils;
use failure::{err_msg, Error};
use std::fs;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};

const REPORT_PROGRESS_LINE_BLOCK: usize = 1_000_000;

pub struct Indexer {
    pub source_id: String, // tag to append to each line
    pub max_lines: usize,  // how many lines to collect before writing out
    pub chunk_size: usize, // used for mapping line numbers to byte positions
}

impl Indexer {
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
    pub fn index_file<T: Read>(
        &self,
        f: T,
        out_path: &std::path::PathBuf,
        append: bool,
        source_file_size: usize,
        to_stdout: bool,
    ) -> Result<Vec<Chunk>, Error> {
        let mut reader = BufReader::new(f);
        let mut line_nr = if append {
            utils::next_line_nr(&out_path)
                .ok_or_else(|| failure::format_err!("could not get last line number of old file"))?
        } else {
            0
        };
        let out_file: std::fs::File = if append {
            std::fs::OpenOptions::new()
                .append(true)
                .create(true)
                .open(out_path)?
        } else {
            std::fs::File::create(&out_path).unwrap()
        };
        let original_file_size =
            out_file.metadata().expect("could not read metadata").len() as usize;
        let mut buf_writer = BufWriter::with_capacity(100 * 1024 * 1024, out_file);

        let mut chunks = vec![];
        let mut buf = vec![];
        let mut processed_bytes = 0;
        let mut chunk_factory = ChunkFactory::new(self.chunk_size, to_stdout, original_file_size);
        while let Ok(len) = reader.read_until(b'\n', &mut buf) {
            let s = unsafe { std::str::from_utf8_unchecked(&buf) };
            let trimmed_line = s.trim_matches(utils::is_newline);
            let trimmed_len = trimmed_line.len();
            let had_newline = trimmed_len != len;
            processed_bytes += len;
            if len == 0 {
                // no more content
                break;
            };
            // only use non-empty lines, others will be dropped
            if trimmed_len != 0 {
                utils::create_tagged_line(
                    self.source_id.as_str(),
                    &mut buf_writer,
                    trimmed_line, //trimmed_line,
                    line_nr,
                    had_newline,
                )?;
                let additional_bytes = utils::extended_line_length(
                    trimmed_len,
                    self.source_id.len(),
                    line_nr,
                    had_newline,
                );
                line_nr += 1;

                if let Some(chunk) = chunk_factory.create_chunk_if_needed(line_nr, additional_bytes)
                {
                    chunks.push(chunk);
                }
                self.report_progress(
                    line_nr,
                    chunk_factory.get_current_byte_index(),
                    processed_bytes,
                    source_file_size,
                );
            }
            buf = vec![];
        }
        buf_writer.flush()?;
        if let Some(chunk) = chunk_factory.create_last_chunk(line_nr, chunks.is_empty()) {
            chunks.push(chunk);
        }
        match chunks.last() {
            Some(last_chunk) => {
                let metadata = fs::metadata(out_path).expect("cannot read size of output file");
                let last_expected_byte_index = metadata.len() as usize;
                if last_expected_byte_index != last_chunk.b.1 {
                    // println!("chunks were: {:?}", chunks);
                    return Err(err_msg(format!(
                        "error in computation! last byte in chunks is {} but should be {}",
                        last_chunk.b.1, last_expected_byte_index
                    )));
                }
            }
            None => eprintln!("no content found"),
        }
        Ok(chunks)
    }
}

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    extern crate rand;
    extern crate tempdir;
    use super::*;
    use pretty_assertions::assert_eq;
    use std::fs;
    use std::fs::File;
    use std::path::PathBuf;
    use tempdir::TempDir;

    fn get_chunks(
        test_content: &str,
        chunksize: usize,
        tag_name: &str,
        tmp_file_name: Option<&str>,
    ) -> (Vec<Chunk>, String) {
        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let test_file_path = tmp_dir.path().join("tmpTestFile.txt");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        fs::write(&test_file_path, test_content).expect("testfile could not be written");

        // call our function
        let f = File::open(&test_file_path).unwrap();
        let indexer = Indexer {
            source_id: tag_name.to_string(), // tag to append to each line
            max_lines: 5,                    // how many lines to collect before writing out
            chunk_size: chunksize,           // used for mapping line numbers to byte positions
        };
        let source_file_size = f.metadata().unwrap().len() as usize;
        let chunks = indexer
            .index_file(
                &f,
                &out_file_path,
                tmp_file_name.is_some(),
                source_file_size,
                false,
            )
            .unwrap();
        let out_file_content: String =
            fs::read_to_string(out_file_path).expect("could not read file");

        // cleanup
        let _ = tmp_dir.close();

        // println!("out_file_content: {}", out_file_content);
        // println!("got chunks: {:?}", chunks);
        (chunks, out_file_content)
    }
    type Pair = (usize, usize);

    fn chunks_fit_together(chunks: &[Chunk]) -> bool {
        if chunks.is_empty() {
            return true;
        }
        let byte_ranges: Vec<(usize, usize)> = chunks.iter().map(|x| x.b).collect();
        let bytes_tail: &[(usize, usize)] = &byte_ranges[1..];
        let bytes_pairs: Vec<(&Pair, &Pair)> = byte_ranges.iter().zip(bytes_tail.iter()).collect();
        let row_ranges: Vec<(usize, usize)> = chunks.iter().map(|x| x.r).collect();
        let row_tail: &[(usize, usize)] = &row_ranges[1..];
        let row_pairs: Vec<(&Pair, &Pair)> = row_ranges.iter().zip(row_tail.iter()).collect();
        bytes_pairs.iter().all(|&(p1, p2)| p1.1 + 1 == p2.0)
            && row_pairs.iter().all(|&(p1, p2)| p1.1 + 1 == p2.0)
    }

    #[test]
    fn test_append_to_empty_output() {
        let tmp_dir = TempDir::new("my_directory_prefix").expect("could not create temp dir");
        let nonempty_file_path = tmp_dir.path().join("not_empty.log");
        let empty_file_path = tmp_dir.path().join("empty.log");
        fs::write(&nonempty_file_path, "A").unwrap();
        // call our function
        fs::write(&empty_file_path, "").expect("testfile could not be written");
        let empty_file = File::open(empty_file_path).unwrap();
        let out_path = tmp_dir.path().join("test_append_to_empty_output.log.out");
        let indexer = Indexer {
            source_id: "tag".to_string(), // tag to append to each line
            max_lines: 5,                 // how many lines to collect before writing out
            chunk_size: 1,                // used for mapping line numbers to byte positions
        };
        let source_file_size = empty_file.metadata().unwrap().len() as usize;
        let chunks = indexer
            .index_file(&empty_file, &out_path, false, source_file_size, false)
            .expect("could not index file");
        assert_eq!(0, chunks.len(), "empty file should produce 0 chunks");
        let out_file_content: String = fs::read_to_string(&out_path).expect("could not read file");
        assert_eq!(
            0,
            out_file_content.len(),
            "empty file should produce empty output"
        );
        let nonempty_file = File::open(nonempty_file_path).unwrap();
        let nonempty_file_size = nonempty_file.metadata().unwrap().len() as usize;
        let chunks2 = indexer
            .index_file(&nonempty_file, &out_path, true, nonempty_file_size, false)
            .expect("could not index file");
        let out_file_content: String = fs::read_to_string(out_path).expect("could not read file");
        println!("outfile: {}\nchunks: {:?}", out_file_content, chunks2);
        assert_eq!(
            1,
            chunks2.len(),
            "nonempty file should produce nonempty output"
        );
        assert_eq!(0, chunks2[0].r.0, "first chunk row should start with 0");
    }
    #[test]
    fn test_chunking_one_chunk_exact() {
        let (chunks, content) = get_chunks("A\n", 1, "some_new_tag", None);
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_one_chunk_to_big() {
        let (chunks, content) = get_chunks("A\n", 2, "tag_ok", None);
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_one_chunk_exact_no_nl() {
        let (chunks, content) = get_chunks("A", 1, "tag_no_nl", None);
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_partly() {
        let (chunks, content) = get_chunks("A\nB\nC", 2, "T", None);
        println!("chunks: {:?}", chunks);
        println!(
            "content ({} bytes): {:02X?}",
            content.as_bytes().len(),
            content.as_bytes()
        );
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_complete() {
        let (chunks, content) = get_chunks("A\nB\nC\nD\n", 2, "tag_chunk_complet", None);
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_complete_no_nl() {
        let (chunks, content) = get_chunks("A\nB\nC\nD", 2, "tag_complete_no_nl", None);
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    fn size_of_all_chunks(chunks: &[Chunk]) -> usize {
        let res = chunks
            .iter()
            .fold(0, |acc, x: &Chunk| acc + (x.b.1 - x.b.0));
        if chunks.len() > 1 {
            res + 1
        } else {
            res
        }
    }

    test_generator::test_expand_paths! { test_input_output; "test_samples/indexing/*" }

    fn test_input_output(dir_name: &str) {
        let in_path = PathBuf::from(&dir_name).join("in.txt");
        let in_file = File::open(in_path).unwrap();
        let indexer = Indexer {
            source_id: "TAG".to_string(),
            max_lines: 5,
            chunk_size: 1,
        };
        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        let in_file_size = in_file.metadata().unwrap().len() as usize;
        let append_to_this = PathBuf::from(&dir_name).join("append_here.log");
        let append_use_case = append_to_this.exists();

        if append_use_case {
            println!("append use case...trying to append to {:?}", append_to_this);
            fs::copy(&append_to_this, &out_file_path).expect("copy content failed");
            println!("copied from {:?}", append_to_this);
            let content = fs::read_to_string(append_to_this).expect("could not read file");
            println!("content was: {:?}", content);
            println!("copied content to: {:?}", out_file_path);
            let content2 = fs::read_to_string(&out_file_path).expect("could not read file");
            println!("copied content was: {:?}", content2);
        }
        let chunks = indexer
            .index_file(
                &in_file,
                &out_file_path,
                append_use_case,
                in_file_size,
                false,
            )
            .unwrap();
        let out_file_content_bytes = fs::read(out_file_path).expect("could not read file");
        let out_file_content = String::from_utf8_lossy(&out_file_content_bytes[..]);
        let expected_path = PathBuf::from(&dir_name).join("expected.output");
        let expected_content_bytes = fs::read(expected_path).expect("could not read expected file");
        let expected_content = String::from_utf8_lossy(&expected_content_bytes[..]);
        println!(
            "comparing\n{}\nto expected:\n{}",
            out_file_content, expected_content
        );
        assert_eq!(expected_content, out_file_content);
        assert_eq!(true, chunks_fit_together(&chunks), "chunks need to fit");
    }

}
