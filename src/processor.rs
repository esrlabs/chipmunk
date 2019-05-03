use crate::report::Chunk;
use std::fmt::Write as W;
use std::io::BufRead;
use std::io::BufReader;
use std::io::Write;

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

pub fn process_file(
    f: &std::fs::File,
    out_file: &mut std::fs::File,
    source_id: &str,
    max_lines: usize,
    chunk_size: usize,
) -> ::std::result::Result<Vec<Chunk>, failure::Error> {
    let row_number_seperator = '\u{0002}';
    let plugin_id_seperator = '\u{0003}';

    let mut reader = BufReader::new(f);
    let mut out_buffer = String::new();
    let mut line_nr = 0;
    let mut lines_in_buffer: usize = 1;

    let mut start_of_chunk_byte_index = 0;
    let mut current_byte_index = 0;
    let mut lines_in_chunk = 0;
    let mut chunks = vec![];
    let mut last_line_current_chunk = 0;
    loop {
        let mut line = String::new();
        let len = reader.read_line(&mut line)?;
        let trimmed_line = line.trim_end_matches(is_newline);
        let trimmed_len = trimmed_line.len();
        let sentinal_length = 1;
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
                plugin_id_seperator,
                source_id,
                plugin_id_seperator,
                row_number_seperator,
                line_nr,
                row_number_seperator,
                if had_newline { "\n" } else { "" },
            )?;
        }
        lines_in_buffer += 1;
        if lines_in_buffer >= max_lines {
            let _ = out_file.write_all(out_buffer.as_bytes());
            out_buffer.clear();
            lines_in_buffer = 0;
        }
        line_nr += 1;

        let length_of_out_line = trimmed_len
            + 4 * sentinal_length
            + source_id.len()
            + linenr_length(line_nr)
            + if had_newline { 1 } else { 0 };
        current_byte_index += length_of_out_line;
        lines_in_chunk += 1;

        if lines_in_chunk >= chunk_size {
            last_line_current_chunk = line_nr - 1;
            let chunk = Chunk {
                r: (line_nr - lines_in_chunk, line_nr - 1),
                b: (start_of_chunk_byte_index, current_byte_index),
            };
            chunks.push(chunk);
            start_of_chunk_byte_index = current_byte_index;
            lines_in_chunk = 0;
        }
    }
    let _ = out_file.write_all(out_buffer.as_bytes());
    if line_nr > last_line_current_chunk + 1 || chunks.is_empty() {
        let chunk = Chunk {
            r: (last_line_current_chunk, line_nr - 1),
            b: (start_of_chunk_byte_index, current_byte_index),
        };
        chunks.push(chunk);
    }
    Ok(chunks)
}

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    extern crate rand;
    use super::*;
    use pretty_assertions::assert_eq;
    use rand::Rng;
    use std::fs;
    use std::fs::File;
    use std::path::PathBuf;

    fn local_file(file_name: &str) -> std::path::PathBuf {
        let mut d = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        d.push(file_name);
        d
    }
    fn get_chunks(test_content: &str, chunk_size: usize, tag_name: &str) -> (Vec<Chunk>, String) {
        let line_count = test_content.lines().count();
        let mut rng = rand::thread_rng();
        let rnd = rng.gen::<u32>();
        let tmp_test_file_name = format!("tmpTestFile{}.txt", rnd);
        let tmp_out_file_name = format!("tmpTestFile{}.txt.out", rnd);

        fs::write(local_file(&tmp_test_file_name[..]), test_content)
            .expect("testfile could not be written");

        // call our function
        let f = File::open(local_file(&tmp_test_file_name[..])).unwrap();
        let out_path = PathBuf::from(&tmp_out_file_name[..]);
        let mut out_file: std::fs::File = File::create(&out_path).unwrap();
        let chunks = process_file(&f, &mut out_file, tag_name, 5, chunk_size).unwrap();
        let out_file_content: String = fs::read_to_string(out_path).expect("could not read file");

        // cleanup
        fs::remove_file(local_file(&tmp_test_file_name[..])).expect("error cleaning up");
        fs::remove_file(local_file(&tmp_out_file_name[..])).expect("error cleaning up");

        // println!("out_file_content: {}", out_file_content);
        // println!("got chunks: {:?}", chunks);
        assert!(line_count < 10);
        (chunks, out_file_content)
    }
    fn run_test(test_content: &str, expected: &[u8], tag_name: &str, expected_chunk_len: usize) {
        let (chunks, out_file_content) = get_chunks(test_content, 5, tag_name);

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
    }

    #[test]
    fn test_process_file() {
        #![allow(non_snake_case)]
        let D1 = 0x03;
        let D2 = 0x02;
        let NL = 0x0a;
        run_test(
            "A",
            &[b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2],
            "tag",
            1,
        );
        run_test(
            "A\n",
            &[b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL],
            "tag",
            1,
        );
        run_test(
            "A\n\n",
            &[b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL],
            "tag",
            1,
        );
        run_test(
            "A\r\n",
            &[b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL],
            "tag",
            1,
        );
        run_test(
            "A\nB\nC\n",
            &[
                [b'A', D1, b't', b'a', b'g', D1, D2, 0x30, D2, NL],
                [b'B', D1, b't', b'a', b'g', D1, D2, 0x31, D2, NL],
                [b'C', D1, b't', b'a', b'g', D1, D2, 0x32, D2, NL],
            ]
            .concat(),
            "tag",
            1,
        );
    }
    #[test]
    fn test_chunking_one_chunk_exact() {
        let (chunks, content) = get_chunks("A\n", 1, "some_new_tag");
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_one_chunk_to_big() {
        let (chunks, content) = get_chunks("A\n", 2, "tag_ok");
        println!("chunks: {:?}", chunks);
        println!("content: {:02X?}", content.as_bytes());
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_one_chunk_exact_no_nl() {
        let (chunks, content) = get_chunks("A", 1, "tag_no_nl");
        assert_eq!(1, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_partly() {
        let (chunks, content) = get_chunks("A\nB\nC", 2, "tag_chunks_partly");
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_complete() {
        let (chunks, content) = get_chunks("A\nB\nC\nD\n", 2, "tag_chunk_complet");
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    #[test]
    fn test_chunking_multiple_chunks_complete_no_nl() {
        let (chunks, content) = get_chunks("A\nB\nC\nD", 2, "tag_complete_no_nl");
        assert_eq!(2, chunks.len());
        assert_eq!(content.len(), size_of_all_chunks(&chunks));
    }
    fn size_of_all_chunks(chunks: &[Chunk]) -> usize {
        chunks
            .iter()
            .fold(0, |acc, x: &Chunk| acc + (x.b.1 - x.b.0))
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
}
