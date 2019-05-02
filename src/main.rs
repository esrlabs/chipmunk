use quicli::prelude::*;
use report::Chunk;
use std::error::Error;
use std::fmt::Write as W;
use std::fs::File;
use std::io::BufRead;
use std::io::BufReader;
use std::io::Write;
use std::path::PathBuf;
use structopt::StructOpt;

mod report;

/// Get first n lines of a file
#[derive(Debug, StructOpt)]
struct Cli {
    /// How many lines to collect before dumping
    #[structopt(long = "max_lines", short = "n", default_value = "1000000")]
    max_lines: usize,
    /// How many lines should be in a chunk (used for access later)
    #[structopt(long = "chunk_size", short = "s", default_value = "500")]
    chunk_size: usize,
    // Add a positional argument that the user has to supply:
    /// The file to read
    file: String,
    source: String,
    // Quick and easy logging setup you get for free with quicli
    #[structopt(flatten)]
    verbosity: Verbosity,
}

fn main() -> CliResult {
    let row_number_seperator = '\u{0002}';
    let plugin_id_seperator = '\u{0003}';
    let args = Cli::from_args();
    let chunk_size = args.chunk_size;

    let f = File::open(&args.file)?;
    let source_id = &args.source;
    let mut reader = BufReader::new(f);

    let path = PathBuf::from(source_id.to_string() + ".out");
    let display = path.display();

    let mut out_file = match File::create(&path) {
        Err(why) => panic!("couldn't create {}: {}", display, why.description()),
        Ok(file) => file,
    };
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
        if len == 0 {
            break;
        };
        writeln!(
            out_buffer,
            "{}{}{}{}{}{}{}",
            line.trim_end(),
            plugin_id_seperator,
            source_id,
            plugin_id_seperator,
            row_number_seperator,
            line_nr,
            row_number_seperator
        )?;
        lines_in_buffer += 1;
        if lines_in_buffer >= args.max_lines {
            let _ = out_file.write_all(out_buffer.as_bytes());
            out_buffer.clear();
            println!("wrote chunk of {} lines", lines_in_buffer);
            lines_in_buffer = 0;
        }
        line_nr += 1;

        current_byte_index += len;
        lines_in_chunk += 1;
        println!("lines_in_chunk: {}", lines_in_chunk);
        if lines_in_chunk >= chunk_size {
            let chunk = Chunk {
                line_range: (line_nr - lines_in_chunk, line_nr - 1),
                byte_range: (start_of_chunk_byte_index, current_byte_index),
            };
            chunks.push(chunk);
            start_of_chunk_byte_index = current_byte_index + 1;
            lines_in_chunk = 0;
        }
    }
    let _ = out_file.write_all(out_buffer.as_bytes());
    println!("wrote last chunk of {} lines", lines_in_buffer);
    let chunk = Chunk {
        line_range: (line_nr - lines_in_chunk, line_nr - 1),
        byte_range: (start_of_chunk_byte_index, current_byte_index),
    };
    chunks.push(chunk);
    let _ = report::serialize_chunks(&chunks);
    Ok(())
}
