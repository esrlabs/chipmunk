use crate::report::Chunk;
use std::fmt::Write as W;
use std::io::BufRead;
use std::io::BufReader;
use std::io::Write;
use std::io::{Read, Seek, SeekFrom};

const ROW_NUMBER_SENTINAL: char = '\u{0002}';
const PLUGIN_ID_SENTINAL: char = '\u{0003}';
const SENTINAL_LENGTH: usize = 1;
const PEEK_END_SIZE: usize = 12;
const REPORT_PROGRESS_LINE_BLOCK: usize = 1_000_000;

pub struct Indexer {
    pub source_id: String, // tag to append to each line
    pub max_lines: usize,  // how many lines to collect before writing out
    pub chunk_size: usize, // used for mapping line numbers to byte positions
}

impl Indexer {
    pub fn index_file(
        &self,
        f: &std::fs::File,
        out_path: &std::path::PathBuf,
        append: bool,
    ) -> ::std::result::Result<Vec<Chunk>, failure::Error> {
        let mut reader = BufReader::new(f);
        let mut out_buffer = String::new();
        let mut line_nr = if append {
            last_line_nr(&out_path).expect("could not get last line number of old file")
        } else {
            0
        };
        let mut lines_in_buffer: usize = 1;
        let mut out_file: std::fs::File = if append {
            std::fs::OpenOptions::new()
                .append(true)
                .open(out_path)
                .expect("could not open file to append")
        } else {
            std::fs::File::create(&out_path).unwrap()
        };
        let original_file_size =
            out_file.metadata().expect("could not read metadata").len() as usize;
        let source_file_size = f.metadata().expect("could not read metadata").len() as usize;

        let mut current_byte_index = original_file_size;
        let mut start_of_chunk_byte_index = current_byte_index;
        let mut lines_in_chunk = 0;
        let mut chunks = vec![];
        let mut last_line_current_chunk = line_nr;
        let mut buf = vec![];
        let mut processed_bytes = 0;
        while let Ok(len) = reader.read_until(b'\n', &mut buf) {
            unsafe {
                let s = std::str::from_utf8_unchecked(&buf);
                let trimmed_line = s.trim_matches(is_newline);
                let trimmed_len = trimmed_line.len();
                let had_newline = trimmed_len != len;
                processed_bytes += len;
                if len == 0 {
                    // no more content
                    break;
                };
                // discard empty lines
                if trimmed_len != 0 {
                    write!(
                        out_buffer,
                        "{}{}{}{}{}{}{}{}",
                        trimmed_line, //trimmed_line,
                        PLUGIN_ID_SENTINAL,
                        self.source_id,
                        PLUGIN_ID_SENTINAL,
                        ROW_NUMBER_SENTINAL,
                        line_nr,
                        ROW_NUMBER_SENTINAL,
                        if had_newline { "\n" } else { "" },
                    )?;
                    lines_in_buffer += 1;
                    // check if we need to flush
                    if lines_in_buffer >= self.max_lines {
                        // println!("flush with content: {:02X?}", out_buffer.as_bytes());
                        let _ = out_file.write_all(out_buffer.as_bytes());
                        out_buffer.clear();
                        lines_in_buffer = 0;
                    }
                    current_byte_index += extended_line_length(
                        trimmed_len,
                        self.source_id.len(),
                        line_nr,
                        had_newline,
                    );
                    line_nr += 1;
                    lines_in_chunk += 1;

                    // check if we need to construct a new mapping chunk
                    if lines_in_chunk >= self.chunk_size {
                        last_line_current_chunk = line_nr;
                        let chunk = Chunk {
                            r: (
                                last_line_current_chunk - lines_in_chunk,
                                last_line_current_chunk,
                            ),
                            b: (start_of_chunk_byte_index, current_byte_index),
                        };
                        chunks.push(chunk);
                        start_of_chunk_byte_index = current_byte_index + 1;
                        lines_in_chunk = 0;
                    }
                    if line_nr % REPORT_PROGRESS_LINE_BLOCK == 0 {
                        println!(
                            "processed {} lines -- byte-index {} ({} %)",
                            line_nr,
                            current_byte_index,
                            (processed_bytes as f32 / source_file_size as f32 * 100.0).round()
                        );
                    }
                }
            };
            buf = vec![];
        }
        // println!("done with content: {:02X?}", out_buffer.as_bytes());
        let _ = out_file.write_all(out_buffer.as_bytes());
        // only add junk if we produced any output lines
        if line_nr > 0 {
            // check if we still need to spit out a chunk
            if line_nr > last_line_current_chunk || chunks.is_empty() {
                let chunk = Chunk {
                    r: (last_line_current_chunk, line_nr - 1),
                    b: (start_of_chunk_byte_index, current_byte_index),
                };
                chunks.push(chunk);
            }
        }
        match chunks.last() {
            Some(last_chunk) => {
                let metadata = out_file
                    .metadata()
                    .expect("cannot read size of output file");
                let last_expected_byte_index = metadata.len() as usize;
                if last_expected_byte_index != last_chunk.b.1 {
                    // println!("chunks were: {:?}", chunks);
                    return Err(failure::err_msg(format!(
                        "error in computation! last byte in chunks is {} but should be {}",
                        last_chunk.b.1, last_expected_byte_index
                    )));
                }
            }
            None => println!("no content found"),
        }
        Ok(chunks)
    }
}

#[inline]
fn is_newline(c: char) -> bool {
    match c {
        '\x0a' => true,
        '\x0d' => true,
        _ => false,
    }
}
#[inline]
fn linenr_length(linenr: usize) -> usize {
    if linenr == 0 {
        return 1;
    };
    let nr = linenr as f64;
    1 + nr.log10().floor() as usize
}
#[inline]
fn extended_line_length(
    trimmed_len: usize,
    tag_len: usize,
    line_nr: usize,
    has_newline: bool,
) -> usize {
    trimmed_len
        + 4 * SENTINAL_LENGTH
        + tag_len
        + linenr_length(line_nr)
        + if has_newline { 1 } else { 0 }
}
fn last_line_nr(path: &std::path::Path) -> Option<usize> {
    let file = std::fs::File::open(path).expect("opening file did not work");
    let file_size = file.metadata().expect("could not read file metadata").len();
    if file_size == 0 {
        println!("file was empty => last_line_nr was 0");
        return Some(0);
    };
    let mut reader = BufReader::new(file);
    let seek_offset: i64 = -(std::cmp::min(file_size - 1, PEEK_END_SIZE as u64) as i64);
    match reader.seek(SeekFrom::End(seek_offset as i64)) {
        Ok(_) => (),
        Err(e) => panic!("could not read last entry in file {:?}", e),
    };
    let size_of_slice = seek_offset.abs() as usize;
    let mut buf: Vec<u8> = vec![0; size_of_slice];
    reader
        .read_exact(&mut buf)
        .expect("reading to buffer should succeed");
    // |tag|#row#\n
    for i in 0..size_of_slice - 1 {
        if buf[i] == (PLUGIN_ID_SENTINAL as u8) && buf[i + 1] == ROW_NUMBER_SENTINAL as u8 {
            // row nr starts at i + 2
            let row_slice = &buf[i + 2..];
            let row_string = std::str::from_utf8(row_slice).expect("could not parse row number");
            let row_nr: usize = row_string
                .trim_end_matches(is_newline)
                .trim_end_matches(ROW_NUMBER_SENTINAL)
                .parse()
                .expect("expected number was was none");
            println!("parsing: {:02X?} => last row_nr: {}", row_slice, row_nr);
            return Some(row_nr);
        }
    }
    None
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

    fn local_file(file_name: &str) -> std::path::PathBuf {
        let mut d = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        d.push(file_name);
        d
    }
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
        let chunks = indexer
            .index_file(&f, &out_file_path, tmp_file_name.is_some())
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
        println!("byte_ranges: {:?}", byte_ranges);
        let tail: &[(usize, usize)] = &byte_ranges[1..];
        println!("tail: {:?}", tail);
        let pairs: Vec<(&Pair, &Pair)> = byte_ranges.iter().zip(tail.iter()).collect();
        println!("pairs: {:?}", pairs);
        pairs.iter().all(|&(p1, p2)| p1.1 + 1 == p2.0)
    }

    const D1: u8 = PLUGIN_ID_SENTINAL as u8;
    const D2: u8 = ROW_NUMBER_SENTINAL as u8;
    const NL: u8 = 0x0a;
    #[test]
    fn test_append_to_empty_output() {
        let empty_file_name = "empty.log";
        let nonempty_file_name = "not_empty.log";
        let out_name = "test_append_to_empty_output.log.out";
        fs::write(local_file(nonempty_file_name), "A").unwrap();
        // call our function
        fs::write(local_file(empty_file_name), "").expect("testfile could not be written");
        let empty_file = File::open(local_file(empty_file_name)).unwrap();
        let out_path = local_file(out_name);
        let indexer = Indexer {
            source_id: "tag".to_string(), // tag to append to each line
            max_lines: 5,                 // how many lines to collect before writing out
            chunk_size: 1,                // used for mapping line numbers to byte positions
        };
        let chunks = indexer
            .index_file(&empty_file, &out_path, false)
            .expect("could not index file");
        assert_eq!(0, chunks.len(), "empty file should produce 0 chunks");
        let out_file_content: String = fs::read_to_string(&out_path).expect("could not read file");
        assert_eq!(
            0,
            out_file_content.len(),
            "empty file should produce empty output"
        );
        let nonempty_file = File::open(local_file(nonempty_file_name)).unwrap();
        let chunks2 = indexer
            .index_file(&nonempty_file, &out_path, true)
            .expect("could not index file");
        let out_file_content: String = fs::read_to_string(out_path).expect("could not read file");
        println!("outfile: {}\nchunks: {:?}", out_file_content, chunks2);
        assert_eq!(
            1,
            chunks2.len(),
            "nonempty file should produce nonempty output"
        );
        assert_eq!(0, chunks2[0].r.0, "first chunk row should start with 0");

        // cleanup
        fs::remove_file(local_file(empty_file_name)).expect("error cleaning up");
        fs::remove_file(local_file(nonempty_file_name)).expect("error cleaning up");
        fs::remove_file(local_file(out_name)).expect("error cleaning up");
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
    #[test]
    fn test_line_nr() {
        assert_eq!(1, linenr_length(0));
        assert_eq!(1, linenr_length(4));
        assert_eq!(2, linenr_length(10));
        assert_eq!(2, linenr_length(99));
        assert_eq!(3, linenr_length(100));
        assert_eq!(5, linenr_length(10000));
    }
    #[test]
    fn test_extract_row_nr() {
        fn check(c: Vec<u8>, expected: usize) {
            let tmp_dir = TempDir::new("my_directory_prefix").expect("could not create temp dir");
            let path = tmp_dir.path().join("extract_row_test.txt");
            fs::write(&path, c).expect("testfile could not be written");
            assert_eq!(Some(expected), last_line_nr(&path));
            let _ = tmp_dir.close();
        }
        let content = [b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL];
        check(content.to_vec(), 0);
        let content2 = [
            b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A', b'A',
            b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL,
        ];
        check(content2.to_vec(), 0);
        let content3 = &[
            [b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL],
            [b'B', D1, b't', b'a', b'g', D1, D2, 0x31, D2, NL],
            [b'C', D1, b't', b'a', b'g', D1, D2, 0x32, D2, NL],
        ]
        .concat();
        check(content3.to_vec(), 2);
    }

    test_generator::test_expand_paths! { test_input_output; "test/*" }

    fn test_input_output(dir_name: &str) {
        let mut in_path = PathBuf::from(&dir_name);
        in_path.push("in.txt");
        let in_file = File::open(in_path).unwrap();
        let indexer = Indexer {
            source_id: "TAG".to_string(),
            max_lines: 5,
            chunk_size: 1,
        };
        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        let chunks = indexer.index_file(&in_file, &out_file_path, false).unwrap();
        let out_file_content_bytes = fs::read(out_file_path).expect("could not read file");
        let out_file_content = String::from_utf8_lossy(&out_file_content_bytes[..]);
        let mut expected_path = PathBuf::from(&dir_name);
        expected_path.push("expected.output");
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
