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
    loop {
        let mut line = String::new();
        let len = reader.read_line(&mut line)?;
        // let trimmed_line = line.trim_end();
        let trimmed_line = line.trim_end_matches(|c: char| is_newline(c));
        let trimmed_len = trimmed_line.len();
        let had_newline = trimmed_len != len;
        println!("line: {:?} (had newline: {})", line.as_bytes(), had_newline);
        if len == 0 {
            // no more content
            break;
        };
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
        lines_in_buffer += 1;
        if lines_in_buffer >= max_lines {
            let _ = out_file.write_all(out_buffer.as_bytes());
            out_buffer.clear();
            println!("wrote chunk of {} lines", lines_in_buffer);
            lines_in_buffer = 0;
        }
        line_nr += 1;

        current_byte_index += trimmed_len;
        lines_in_chunk += 1;
        if lines_in_chunk >= chunk_size {
            let chunk = Chunk {
                r: (line_nr - lines_in_chunk, line_nr - 1),
                b: (start_of_chunk_byte_index, current_byte_index),
            };
            chunks.push(chunk);
            start_of_chunk_byte_index = current_byte_index + 1;
            lines_in_chunk = 0;
        }
    }
    let _ = out_file.write_all(out_buffer.as_bytes());
    println!("wrote last chunk of {} lines", lines_in_buffer);
    let chunk = Chunk {
        r: (line_nr - lines_in_chunk, line_nr - 1),
        b: (start_of_chunk_byte_index, current_byte_index),
    };
    chunks.push(chunk);
    Ok(chunks)
}

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;
    use std::fs;
    use std::fs::File;
    use std::path::PathBuf;

    fn local_file(file_name: &str) -> std::path::PathBuf {
        let mut d = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        d.push(file_name);
        return d;
    }
    fn run_test(
        test_content: &str,
        delimiter_one: &str,
        delimiter_two: &str,
        tag_name: &str,
        expected_chunk_len: usize,
    ) {
        let line_count = test_content.lines().count();
        println!("line_count: {}", line_count);
        let tmp_test_file_name = "tmpTestFile.txt";
        let tmp_out_file_name = "tmpTestFile.txt.out";
        let original = fs::read_to_string(local_file("test.txt"))
            .expect("Something went wrong reading the file");
        println!("file length: {}", original.len());

        fs::write(local_file(tmp_test_file_name), test_content)
            .expect("testfile could not be written");

        // call our function
        let f = File::open(local_file(tmp_test_file_name)).unwrap();
        let out_path = PathBuf::from(tmp_out_file_name);
        let mut out_file: std::fs::File = File::create(&out_path).unwrap();
        let chunks = process_file(&f, &mut out_file, tag_name, 5, 5).unwrap();
        let out_file_content = fs::read_to_string(out_path).expect("could not read file");
        println!("out_file_content: {}", out_file_content);

        println!("got chunks: {:?}", chunks);
        assert_eq!(
            chunks.len(),
            expected_chunk_len,
            "chunks should match expected length {}",
            expected_chunk_len
        );
        let line_nr_size = 1;
        assert!(line_count < 10);
        let appended_size = line_count //only valid for up to 9 lines
            * (2 * delimiter_one.len() + 2 * delimiter_two.len() + tag_name.len() + line_nr_size);
        assert_eq!(
            out_file_content.len(),
            test_content.len() + appended_size,
            "out content should match expected size"
        );

        // cleanup
        fs::remove_file(local_file(tmp_test_file_name)).expect("error cleaning up");
        fs::remove_file(local_file(tmp_out_file_name)).expect("error cleaning up");
    }
    #[test]
    fn test_process_file() {
        run_test("A", "X", "Y", "tag", 1);
        run_test("A\n", "X", "Y", "tag", 1);
        run_test("A\nB\nC\n", "X", "Y", "tag", 1);
        run_test("A\nB\nC", "X", "Y", "tag", 1);
    }
}
