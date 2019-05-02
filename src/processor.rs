use crate::report::serialize_chunks;
use crate::report::Chunk;
use quicli::prelude::*;
use std::fmt::Write as W;
use std::io::BufRead;
use std::io::BufReader;
use std::io::Write;

pub fn process_file(
    f: &std::fs::File,
    out_file: &mut std::fs::File,
    source_id: &str,
    max_lines: usize,
    chunk_size: usize,
) -> CliResult {
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
        let trimmed_line = line.trim_end();
        let trimmed_len = trimmed_line.len();
        println!("read {} bytes == {}", trimmed_len, trimmed_line);
        if len == 0 {
            break;
        };
        writeln!(
            out_buffer,
            "{}{}{}{}{}{}{}",
            trimmed_line,
            plugin_id_seperator,
            source_id,
            plugin_id_seperator,
            row_number_seperator,
            line_nr,
            row_number_seperator
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
    let _ = serialize_chunks(&chunks);
    Ok(())
}
