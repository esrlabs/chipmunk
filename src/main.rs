use crate::report::serialize_chunks;
use crate::report::Chunk;
use quicli::prelude::*;
use std::fs;
use std::path::PathBuf;
use structopt::StructOpt;

mod processor;
mod report;

/// Create index file and mapping file for logviewer
#[derive(Debug, StructOpt)]
struct Cli {
    /// How many lines to collect before dumping
    #[structopt(long = "max_lines", short = "n", default_value = "1000000")]
    max_lines: usize,
    /// How many lines should be in a chunk (used for access later)
    #[structopt(long = "chunk_size", short = "s", default_value = "500")]
    chunk_size: usize,
    /// append to file if exists
    #[structopt(long = "append", short = "a")]
    append: bool,
    // Add a positional argument that the user has to supply:
    /// The file to read
    file: String,
    /// how to tag the source
    tag: String,
    /// Output file, "<file>.out" if not present
    #[structopt(parse(from_os_str))]
    output: Option<PathBuf>,
    // Quick and easy logging setup you get for free with quicli
    #[structopt(flatten)]
    verbosity: Verbosity,
}

fn main() -> CliResult {
    let args = Cli::from_args();
    let chunk_size = args.chunk_size;

    let f: fs::File = fs::File::open(&args.file)?;
    let tag_id = &args.tag;

    let out_path: std::path::PathBuf = match args.output {
        Some(path) => path,
        None => PathBuf::from(args.file.to_string() + ".out"),
    };

    if args.append && !out_path.exists() {
        panic!("appending only possible when {:?} exixts", out_path);
    }
    let mapping_out_path: std::path::PathBuf = PathBuf::from(args.file.to_string() + ".map.json");
    let current_chunks: Vec<Chunk> = Vec::new();

    match processor::process_file(
        &f,
        &out_path,
        &current_chunks,
        tag_id,
        args.max_lines,
        chunk_size,
        args.append,
    ) {
        Err(why) => panic!("couldn't process: {}", why),
        Ok(chunks) => {
            let _ = serialize_chunks(&chunks, &mapping_out_path);
            Ok(())
        }
    }
}
