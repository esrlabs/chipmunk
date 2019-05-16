use crate::chunks::serialize_chunks;
use quicli::prelude::{CliResult, Verbosity};
use std::fs;
use std::path::PathBuf;
use std::process;
use std::time::Instant;
use structopt::StructOpt;

mod chunks;
mod merger;
mod processor;
mod utils;

/// Create index file and mapping file for logviewer
#[derive(Debug, StructOpt)]
struct Cli {
    /// How many lines to collect before dumping
    #[structopt(long = "max_lines", short = "n", default_value = "1000000")]
    max_lines: usize,
    /// How many lines should be in a chunk (used for access later)
    #[structopt(long = "chunk_size", short = "c", default_value = "500")]
    chunk_size: usize,
    /// put out chunk information on stdout
    #[structopt(long = "stdout", short = "s")]
    stdout: bool,
    /// append to file if exists
    #[structopt(long = "append", short = "a")]
    append: bool,
    /// input file is a json file that defines all files to be merged
    #[structopt(long = "merge", short = "m")]
    merge_config_file: Option<String>,
    /// The file to read
    #[structopt(long = "index", short = "i")]
    file_to_index: Option<String>,
    /// how to tag the source
    #[structopt(long = "tag", short = "t")]
    tag: Option<String>,
    /// Output file, "<file_to_index>.out" if not present
    #[structopt(long = "out", short = "o")]
    output: Option<String>,
    // Quick and easy logging setup you get for free with quicli
    #[structopt(flatten)]
    verbosity: Verbosity,
}

fn main() -> CliResult {
    let start = Instant::now();

    let args = Cli::from_args();

    match args.merge_config_file {
        Some(merge_config_file_name) => {
            let out_path: std::path::PathBuf = match args.output {
                Some(path) => PathBuf::from(path),
                None => {
                    eprintln!("no output file specified");
                    process::exit(2)
                }
            };
            let merger = merger::Merger {
                max_lines: args.max_lines,   // how many lines to collect before writing out
                chunk_size: args.chunk_size, // used for mapping line numbers to byte positions
            };
            let config_path = PathBuf::from(merge_config_file_name);
            let merged_lines = match merger.merge_files_use_config_file(
                &config_path,
                &out_path,
                args.append,
                args.stdout,
            ) {
                Ok(cnt) => cnt,
                Err(e) => {
                    eprintln!("error merging: {}", e);
                    process::exit(2)
                }
            };
            let elapsed = start.elapsed();
            let ms = elapsed.as_millis();
            let duration_in_s = ms as f64 / 1000.0;
            eprintln!("merging {} lines took {:.3}s!", merged_lines, duration_in_s);
            Ok(())
        }
        None => {
            let file = match args.file_to_index {
                Some(f) => f,
                None => {
                    eprintln!("file to index was not provided");
                    process::exit(2)
                }
            };
            let tag = match args.tag {
                Some(f) => f,
                None => {
                    eprintln!("tag was not provided");
                    process::exit(2)
                }
            };
            let out_path: std::path::PathBuf = match args.output {
                Some(path) => PathBuf::from(path),
                None => PathBuf::from(file.to_string() + ".out"),
            };
            let mapping_out_path: std::path::PathBuf =
                PathBuf::from(file.to_string() + ".map.json");

            let indexer = processor::Indexer {
                source_id: tag,              // tag to append to each line
                max_lines: args.max_lines,   // how many lines to collect before writing out
                chunk_size: args.chunk_size, // used for mapping line numbers to byte positions
            };

            let f = match fs::File::open(&file) {
                Ok(file) => file,
                Err(_) => {
                    eprintln!("could not open {}", file);
                    process::exit(2)
                }
            };

            let source_file_size = f.metadata()?.len() as usize;
            match indexer.index_file(&f, &out_path, args.append, source_file_size, args.stdout) {
                Err(why) => {
                    eprintln!("couldn't process: {}", why);
                    process::exit(2)
                }
                Ok(chunks) => {
                    let _ = serialize_chunks(&chunks, &mapping_out_path);
                    let elapsed = start.elapsed();
                    let ms = elapsed.as_millis();
                    let duration_in_s = ms as f64 / 1000.0;
                    let file_size_in_mb = f.metadata().expect("could not read file metadata").len()
                        as f64
                        / 1024.0
                        / 1024.0;
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
    }
}
