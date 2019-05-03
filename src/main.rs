use crate::report::serialize_chunks;
use quicli::prelude::*;
use std::error::Error;
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
    // Add a positional argument that the user has to supply:
    /// The file to read
    file: String,
    /// how to tag the source
    source: String,
    // Quick and easy logging setup you get for free with quicli
    #[structopt(flatten)]
    verbosity: Verbosity,
}

fn main() -> CliResult {
    let args = Cli::from_args();
    let chunk_size = args.chunk_size;

    let f: fs::File = fs::File::open(&args.file)?;
    let source_id = &args.source;
    // let mut reader = BufReader::new(f);

    let path = PathBuf::from(args.file.to_string() + ".out");
    let display = path.display();

    let mut out_file: fs::File = match fs::File::create(&path) {
        Err(why) => panic!("couldn't create {}: {}", display, why.description()),
        Ok(file) => file,
    };
    match processor::process_file(&f, &mut out_file, source_id, args.max_lines, chunk_size) {
        Err(why) => panic!("couldn't process: {}", why),
        Ok(chunks) => {
            match chunks.last() {
                Some(last_chunk) => {
                    let metadata = fs::metadata(&path)?;
                    if metadata.len() as usize != last_chunk.b.1 {
                        panic!(
                            "error in computation! last byte in chunks is {} but should be {}",
                            last_chunk.b.1,
                            metadata.len()
                        );
                    }
                }
                None => println!("no content found"),
            }

            let _ = serialize_chunks(&chunks);
            Ok(())
        }
    }
}
