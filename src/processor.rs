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

#[inline]
fn is_newline(c: char) -> bool {
    match c {
        '\x0a' => true,
        '\x0d' => true,
        _ => false,
    }
}
fn linenr_length(linenr: usize) -> usize {
    if linenr == 0 {
        return 1;
    };
    let nr = linenr as f64;
    1 + nr.log10().floor() as usize
}
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
    // println!("extended_line_length (line_nr={}): {}", line_nr, res);
}
fn last_line_nr(path: &std::path::Path) -> Option<usize> {
    let file = std::fs::File::open(path).expect("opening file did not work");
    let file_size = file.metadata().expect("could not read file metadata").len();
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

pub fn process_file(
    f: &std::fs::File,
    out_path: &std::path::PathBuf,
    current_chunks: &[Chunk],
    source_id: &str,   // tag to append to each line
    max_lines: usize,  // how many lines to collect before writing out
    chunk_size: usize, // used for mapping line numbers to byte positions
    append: bool,
) -> ::std::result::Result<Vec<Chunk>, failure::Error> {
    println!(
        "process file, currently have {} chunks",
        current_chunks.len()
    );
    let mut reader = BufReader::new(f);
    let mut out_buffer = String::new();
    let mut line_nr = if append {
        println!("trying to append to {:?}", out_path);
        last_line_nr(&out_path).expect("could not get last line number of old file") + 1
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
    let original_file_size = out_file.metadata().expect("could not read metadata").len() as usize;

    let mut current_byte_index = original_file_size;
    let mut start_of_chunk_byte_index = current_byte_index;
    let mut lines_in_chunk = 0;
    let mut chunks = vec![];
    let mut last_line_current_chunk = line_nr;
    loop {
        let mut line = String::new();
        let len = reader.read_line(&mut line)?;
        let trimmed_line = line.trim_end_matches(is_newline);
        let trimmed_len = trimmed_line.len();
        let had_newline = trimmed_len != len;
        if len == 0 {
            // no more content
            break;
        };
        // discard empty lines
        if trimmed_len != 0 {
            write!(
                out_buffer,
                "{}{}{}{}{}{}{}{}",
                trimmed_line,
                PLUGIN_ID_SENTINAL,
                source_id,
                PLUGIN_ID_SENTINAL,
                ROW_NUMBER_SENTINAL,
                line_nr,
                ROW_NUMBER_SENTINAL,
                if had_newline { "\n" } else { "" },
            )?;
            lines_in_buffer += 1;
            // check if we need to flush
            if lines_in_buffer >= max_lines {
                // println!("flush with content: {:02X?}", out_buffer.as_bytes());
                let _ = out_file.write_all(out_buffer.as_bytes());
                out_buffer.clear();
                lines_in_buffer = 0;
            }
            current_byte_index +=
                extended_line_length(trimmed_len, source_id.len(), line_nr, had_newline);
            line_nr += 1;
            lines_in_chunk += 1;

            // check if we need to construct a new mapping chunk
            if lines_in_chunk >= chunk_size {
                println!(
                    "create chunk, line_nr={}, lines_in_chunk: {}",
                    line_nr, lines_in_chunk
                );
                last_line_current_chunk = line_nr - 1;
                let chunk = Chunk {
                    r: (line_nr - lines_in_chunk, line_nr - 1),
                    b: (start_of_chunk_byte_index, current_byte_index),
                };
                chunks.push(chunk);
                start_of_chunk_byte_index = current_byte_index + 1;
                lines_in_chunk = 0;
            }
        }
    }
    // println!("done with content: {:02X?}", out_buffer.as_bytes());
    let _ = out_file.write_all(out_buffer.as_bytes());
    // check if we still need to spit out a chunk
    if line_nr > last_line_current_chunk + 1 || chunks.is_empty() {
        println!(
            "create LAST chunk, line_nr={}, lines_in_chunk: {}",
            line_nr, lines_in_chunk
        );
        let chunk = Chunk {
            r: (last_line_current_chunk, line_nr - 1),
            b: (start_of_chunk_byte_index, current_byte_index),
        };
        chunks.push(chunk);
    }
    match chunks.last() {
        Some(last_chunk) => {
            let metadata = out_file
                .metadata()
                .expect("cannot read size of output file");
            let last_expected_byte_index = metadata.len() as usize;
            if last_expected_byte_index != last_chunk.b.1 {
                panic!(
                    "error in computation! last byte in chunks is {} but should be {}",
                    last_chunk.b.1, last_expected_byte_index
                );
            }
        }
        None => println!("no content found"),
    }
    Ok(chunks)
}

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    extern crate rand;
    extern crate tempdir;
    use super::*;
    use pretty_assertions::assert_eq;
    use rand::Rng;
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
        chunk_size: usize,
        tag_name: &str,
        tmp_file_name: Option<&str>,
    ) -> (Vec<Chunk>, String) {
        let (tmp_test_file_name, tmp_out_file_name) = match tmp_file_name {
            Some(file_name) => (file_name.to_string(), format!("{}.out", file_name)),
            None => {
                let mut rng = rand::thread_rng();
                let rnd = rng.gen::<u32>();
                (
                    format!("tmpTestFile{}.txt", rnd),
                    format!("tmpTestFile{}.txt.out", rnd),
                )
            }
        };

        fs::write(local_file(&tmp_test_file_name[..]), test_content)
            .expect("testfile could not be written");

        // call our function
        let f = File::open(local_file(&tmp_test_file_name[..])).unwrap();
        let out_path = PathBuf::from(&tmp_out_file_name[..]);
        let chunks = process_file(
            &f,
            &out_path,
            &[],
            tag_name,
            5,
            chunk_size,
            tmp_file_name.is_some(),
        )
        .unwrap();
        let out_file_content: String = fs::read_to_string(out_path).expect("could not read file");

        // cleanup
        fs::remove_file(local_file(&tmp_test_file_name[..])).expect("error cleaning up");
        fs::remove_file(local_file(&tmp_out_file_name[..])).expect("error cleaning up");

        // println!("out_file_content: {}", out_file_content);
        // println!("got chunks: {:?}", chunks);
        (chunks, out_file_content)
    }
    type Pair = (usize, usize);
    fn chunks_fit_together(chunks: &[Chunk]) -> bool {
        let byte_ranges: Vec<(usize, usize)> = chunks.iter().map(|x| x.b).collect();
        println!("byte_ranges: {:?}", byte_ranges);
        let tail: &[(usize, usize)] = &byte_ranges[1..];
        println!("tail: {:?}", tail);
        let pairs: Vec<(&Pair, &Pair)> = byte_ranges.iter().zip(tail.iter()).collect();
        println!("pairs: {:?}", pairs);
        pairs.iter().all(|&(p1, p2)| p1.1 + 1 == p2.0)
    }
    fn run_test(
        test_content: &str,
        expected: &[u8],
        tag_name: &str,
        (lines_per_chunk, expected_chunk_len): (usize, usize),
        append: bool,
    ) {
        let (chunks, out_file_content) = get_chunks(test_content, lines_per_chunk, tag_name, None);
        println!("all chunks: {:?}", chunks);
        println!("content: {:02X?}", out_file_content.as_bytes());
        assert_eq!(
            chunks.len(),
            expected_chunk_len,
            "chunks should match expected length {}",
            expected_chunk_len
        );
        assert_eq!(
            out_file_content.as_bytes(),
            expected,
            "out content should match expected size",
        );
        assert_eq!(true, chunks_fit_together(&chunks), "chunks need to fit");
    }

    const D1: u8 = PLUGIN_ID_SENTINAL as u8;
    const D2: u8 = ROW_NUMBER_SENTINAL as u8;
    const NL: u8 = 0x0a;
    #[test]
    fn test_process_file_one_line() {
        run_test(
            "A",
            &[b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2],
            "tag",
            (1, 1),
            false,
        );
    }
    #[test]
    fn test_process_file_one_line_with_newline() {
        run_test(
            "A\n",
            &[b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL],
            "tag",
            (1, 1),
            false,
        );
    }
    #[test]
    fn test_process_file_one_line_with_2_newline() {
        run_test(
            "A\n\n",
            &[b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL],
            "tag",
            (1, 1),
            false,
        );
    }
    #[test]
    fn test_process_file_one_line_with_crlf() {
        run_test(
            "A\r\n",
            &[b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL],
            "tag",
            (1, 1),
            false,
        );
    }
    #[test]
    fn test_process_file_multiple_lines_with_lf() {
        run_test(
            "A\nB\nC\n",
            &[
                [b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL],
                [b'B', D1, b't', b'a', b'g', D1, D2, 0x31, D2, NL],
                [b'C', D1, b't', b'a', b'g', D1, D2, 0x32, D2, NL],
            ]
            .concat(),
            "tag",
            (1, 3),
            false,
        );
    }
    #[test]
    fn test_process_file_long_multiple_lines_with_lf() {
        run_test(
            "0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n",
            &[
                [b'0', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL],
                [b'1', D1, b't', b'a', b'g', D1, D2, 0x31, D2, NL],
                [b'2', D1, b't', b'a', b'g', D1, D2, 0x32, D2, NL],
                [b'3', D1, b't', b'a', b'g', D1, D2, 0x33, D2, NL],
                [b'4', D1, b't', b'a', b'g', D1, D2, 0x34, D2, NL],
                [b'5', D1, b't', b'a', b'g', D1, D2, 0x35, D2, NL],
                [b'6', D1, b't', b'a', b'g', D1, D2, 0x36, D2, NL],
                [b'7', D1, b't', b'a', b'g', D1, D2, 0x37, D2, NL],
                [b'8', D1, b't', b'a', b'g', D1, D2, 0x38, D2, NL],
                [b'9', D1, b't', b'a', b'g', D1, D2, 0x39, D2, NL],
            ]
            .concat(),
            "tag",
            (1, 10),
            false,
        );
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
}
