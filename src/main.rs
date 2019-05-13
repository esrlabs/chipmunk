use crate::report::serialize_chunks;
use quicli::prelude::{CliResult, Verbosity};
use std::fs;
use std::path::PathBuf;
use std::process;
use std::time::Instant;
use structopt::StructOpt;

mod merger;
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
    /// put out chunk information on stdout
    #[structopt(long = "stdout", short = "t")]
    stdout: bool,
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
    let start = Instant::now();

    let args = Cli::from_args();

    let f: fs::File = fs::File::open(&args.file)?;
    let tag_id = &args.tag;

    let out_path: std::path::PathBuf = match args.output {
        Some(path) => path,
        None => PathBuf::from(args.file.to_string() + ".out"),
    };

    if args.append && !out_path.exists() {
        let _ = fs::File::create(&out_path);
    }
    let mapping_out_path: std::path::PathBuf = PathBuf::from(args.file.to_string() + ".map.json");

    let indexer = processor::Indexer {
        source_id: tag_id.to_string(), // tag to append to each line
        max_lines: args.max_lines,     // how many lines to collect before writing out
        chunk_size: args.chunk_size,   // used for mapping line numbers to byte positions
    };

    match indexer.index_file(&f, &out_path, args.append, args.stdout) {
        Err(why) => {
            eprintln!("couldn't process: {}", why);
            process::exit(2)
        }
        Ok(chunks) => {
            let _ = serialize_chunks(&chunks, &mapping_out_path);
            let elapsed = start.elapsed();
            let ms = elapsed.as_millis();
            let duration_in_s = ms as f64 / 1000.0;
            let file_size_in_mb =
                f.metadata().expect("could not read file metadata").len() as f64 / 1024.0 / 1024.0;
            let mb_bytes_per_second: f64 = file_size_in_mb / duration_in_s;
            eprintln!(
                "processing ~{} MB took {:.3}s! ({:.3} MB/s)",
                file_size_in_mb.round(),
                duration_in_s,
                mb_bytes_per_second
            );
            Ok(())
        }
    }
}
