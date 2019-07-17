#![feature(test)]
extern crate test;
#[macro_use]
extern crate lazy_static;
use crate::chunks::serialize_chunks;
use crate::parse::{
    line_matching_format_expression, match_format_string_in_file, read_format_string_options,
    FormatTestOptions,
};

#[macro_use]
extern crate clap;
use clap::{App, Arg, SubCommand};
use std::fs;
use std::path;
use std::time::Instant;

mod chunks;
mod dlt;
mod dlt_parse;
mod dlt_tokio;
mod merger;
mod parse;
mod processor;

mod timedline;
mod utils;

fn main() {
    let start = Instant::now();
    let matches = App::new("logviewer_parser")
        .version(crate_version!())
        .author(crate_authors!())
        .about("Create index file and mapping file for logviewer")
        .arg(
            Arg::with_name("v")
                .short("v")
                .multiple(true)
                .help("Sets the level of verbosity"),
        )
        .subcommand(
            SubCommand::with_name("index")
                .about("command for creating an index file")
                .arg(
                    Arg::with_name("input")
                        .short("i")
                        .long("input")
                        .help("Sets the input file to be indexed")
                        .required(true)
                        .index(1),
                )
                .arg(
                    Arg::with_name("tag")
                        .short("t")
                        .long("tag")
                        .value_name("TAG")
                        .help("tag for each log entry")
                        .required(true),
                )
                .arg(
                    Arg::with_name("output")
                        .short("o")
                        .long("out")
                        .value_name("OUT")
                        .help("Output file, \"<file_to_index>.out\" if not present"),
                )
                .arg(
                    Arg::with_name("max_lines")
                        .short("n")
                        .long("max_lines")
                        .help("How many lines to collect before dumping")
                        .required(false)
                        .default_value("1000000"),
                )
                .arg(
                    Arg::with_name("chunk_size")
                        .short("c")
                        .long("chunk_siz")
                        .help("How many lines should be in a chunk (used for access later)")
                        .required(false)
                        .default_value("500"),
                )
                .arg(
                    Arg::with_name("append")
                        .short("a")
                        .long("append")
                        .help("append to file if exists"),
                )
                .arg(
                    Arg::with_name("stdout")
                        .short("s")
                        .long("stdout")
                        .help("put out chunk information on stdout"),
                ),
        )
        .subcommand(
            SubCommand::with_name("merge")
                .about("command for merging multiple log files")
                .arg(
                    Arg::with_name("merge_config")
                        .short("m")
                        .long("merge")
                        .help("input file is a json file that defines all files to be merged")
                        .required(true)
                        .index(1),
                )
                .arg(
                    Arg::with_name("output")
                        .short("o")
                        .long("out")
                        .value_name("OUT")
                        .required(true)
                        .help("Output file"),
                )
                .arg(
                    Arg::with_name("max_lines")
                        .short("n")
                        .long("max_lines")
                        .help("How many lines to collect before dumping")
                        .required(false)
                        .default_value("1000000"),
                )
                .arg(
                    Arg::with_name("chunk_size")
                        .short("c")
                        .long("chunk_siz")
                        .help("How many lines should be in a chunk (used for access later)")
                        .required(false)
                        .default_value("500"),
                )
                .arg(
                    Arg::with_name("append")
                        .short("a")
                        .long("append")
                        .help("append to file if exists"),
                )
                .arg(
                    Arg::with_name("stdout")
                        .short("s")
                        .long("stdout")
                        .help("put out chunk information on stdout"),
                ),
        )
        .subcommand(
            SubCommand::with_name("format")
                .about("test format string")
                .arg(
                    Arg::with_name("format-string")
                        .short("f")
                        .help("format string to use")
                        .long("format")
                        .requires("test-string")
                        .value_name("FORMAT_STR")
                        .required(false),
                )
                .arg(
                    Arg::with_name("test-string")
                        .short("t")
                        .long("test")
                        .requires("format-string")
                        .help("test string to use")
                        .value_name("SAMPLE")
                        .required(false),
                )
                .arg(
                    Arg::with_name("test-config")
                        .short("c")
                        .long("config")
                        .help("test a file using this configuration")
                        .value_name("CONFIG")
                        .required(false),
                ),
        )
        .subcommand(
            SubCommand::with_name("dlt")
                .about("handling dtl input")
                .arg(
                    Arg::with_name("input")
                        .short("i")
                        .long("input")
                        .help("the DLT file to parse")
                        .required(true)
                        .index(1),
                )
                .arg(
                    Arg::with_name("tag")
                        .short("t")
                        .long("tag")
                        .value_name("TAG")
                        .help("tag for each log entry")
                        .required(true),
                )
                .arg(
                    Arg::with_name("max_lines")
                        .short("n")
                        .long("max_lines")
                        .help("How many lines to collect before dumping")
                        .required(false)
                        .default_value("1000000"),
                )
                .arg(
                    Arg::with_name("chunk_size")
                        .short("c")
                        .long("chunk_siz")
                        .help("How many lines should be in a chunk (used for access later)")
                        .required(false)
                        .default_value("500"),
                )
                .arg(
                    Arg::with_name("append")
                        .short("a")
                        .long("append")
                        .help("append to file if exists"),
                )
                .arg(
                    Arg::with_name("output")
                        .short("o")
                        .long("out")
                        .value_name("OUT")
                        .help("Output file, \"<file_to_index>.out\" if not present"),
                )
                .arg(
                    Arg::with_name("stdout")
                        .short("s")
                        .long("stdout")
                        .help("put out chunk information on stdout"),
                ),
        )
        .get_matches();

    // Vary the output based on how many times the user used the "verbose" flag
    // (i.e. 'myprog -v -v -v' or 'myprog -vvv' vs 'myprog -v'
    let use_stderr_for_status_updates = matches.occurrences_of("v") >= 1;

    if let Some(matches) = matches.subcommand_matches("merge") {
        handle_merge_subcommand(matches, start, use_stderr_for_status_updates)
    } else if let Some(matches) = matches.subcommand_matches("index") {
        handle_index_subcommand(matches, start, use_stderr_for_status_updates)
    } else if let Some(matches) = matches.subcommand_matches("format") {
        handle_format_subcommand(matches, start, use_stderr_for_status_updates)
    } else if let Some(matches) = matches.subcommand_matches("dlt") {
        handle_dlt_subcommand(matches, start, use_stderr_for_status_updates)
    }

    fn handle_index_subcommand(
        matches: &clap::ArgMatches,
        start: std::time::Instant,
        status_updates: bool,
    ) {
        if matches.is_present("input") && matches.is_present("tag") {
            let file = matches.value_of("input").expect("input must be present");
            let tag = matches.value_of("tag").expect("tag must be present");
            let fallback_out = file.to_string() + ".out";
            let out_path = path::PathBuf::from(
                matches
                    .value_of("output")
                    .unwrap_or_else(|| fallback_out.as_str()),
            );
            let mapping_out_path: path::PathBuf =
                path::PathBuf::from(file.to_string() + ".map.json");
            let max_lines = value_t_or_exit!(matches.value_of("max_lines"), usize);
            let chunk_size = value_t_or_exit!(matches.value_of("chunk_size"), usize);

            let f = match fs::File::open(&file) {
                Ok(file) => file,
                Err(_) => {
                    eprintln!("could not open {}", file);
                    std::process::exit(2)
                }
            };

            let source_file_size = match f.metadata() {
                Ok(file_meta) => file_meta.len() as usize,
                Err(_) => {
                    eprintln!("could not find out size of source file");
                    std::process::exit(2);
                }
            };
            let append: bool = matches.is_present("append");
            let stdout: bool = matches.is_present("stdout");

            match processor::create_index_and_mapping(processor::IndexingConfig {
                tag,
                max_lines,
                chunk_size,
                in_file: f,
                out_path: &out_path,
                append,
                source_file_size,
                to_stdout: stdout,
                status_updates,
            }) {
                // match processor::create_index_and_mapping(processor::IndexingConfig {
                //     tag,
                //     max_lines,
                //     chunk_size,
                //     in_file: f,
                //     out_path: &out_path,
                //     append,
                //     source_file_size,
                //     to_stdout: stdout,
                //     status_updates,
                // }) {
                Err(why) => {
                    eprintln!("couldn't process: {}", why);
                    std::process::exit(2)
                }
                Ok(chunks) => {
                    let _ = serialize_chunks(&chunks, &mapping_out_path);
                    let file_size_in_mb = source_file_size as f64 / 1024.0 / 1024.0;
                    if status_updates {
                        duration_report_throughput(
                            start,
                            format!("processing ~{} MB", file_size_in_mb.round()),
                            file_size_in_mb,
                            "MB".to_string(),
                        )
                    }
                }
            }
        }
    }

    fn handle_merge_subcommand(
        matches: &clap::ArgMatches,
        start: std::time::Instant,
        status_updates: bool,
    ) {
        if matches.is_present("merge_config") {
            let merge_config_file_name: &str = matches
                .value_of("merge_config")
                .expect("merge_config must be present");
            let out_path: path::PathBuf = match matches.value_of("output") {
                Some(path) => path::PathBuf::from(path),
                None => {
                    eprintln!("no output file specified");
                    std::process::exit(2)
                }
            };
            let max_lines = value_t_or_exit!(matches.value_of("max_lines"), usize);
            let chunk_size = value_t_or_exit!(matches.value_of("chunk_size"), usize);
            let append: bool = matches.is_present("append");
            let stdout: bool = matches.is_present("stdout");
            let merger = merger::Merger {
                max_lines,  // how many lines to collect before writing out
                chunk_size, // used for mapping line numbers to byte positions
            };
            let config_path = path::PathBuf::from(merge_config_file_name);
            let merged_lines = match merger.merge_files_use_config_file(
                &config_path,
                &out_path,
                append,
                stdout,
                status_updates,
            ) {
                Ok(cnt) => cnt,
                Err(e) => {
                    eprintln!("error merging: {}", e);
                    std::process::exit(2)
                }
            };
            if status_updates {
                duration_report(start, format!("merging {} lines", merged_lines));
            }
        }
    }

    fn handle_format_subcommand(
        matches: &clap::ArgMatches,
        start: std::time::Instant,
        status_updates: bool,
    ) {
        if matches.is_present("test-string") && matches.is_present("format-string") {
            let format_string = matches
                .value_of("format-string")
                .expect("format-string must be present");
            let test_string = matches
                .value_of("test-string")
                .expect("test-string must be present");
            println!(
                "format-string: {}, test_string: {}",
                format_string, test_string
            );
            match line_matching_format_expression(format_string, test_string) {
                Ok(res) => println!("match: {:?}", res),
                Err(e) => {
                    eprintln!("error matching: {}", e);
                    std::process::exit(2)
                }
            }
        } else if matches.is_present("test-config") {
            let test_config_name = matches
                .value_of("test-config")
                .expect("test-config-name must be present");
            let config_path = path::PathBuf::from(test_config_name);
            let mut test_config_file = match fs::File::open(&config_path) {
                Ok(file) => file,
                Err(_) => {
                    eprintln!("could not open {}", test_config_name);
                    std::process::exit(2)
                }
            };
            let options: FormatTestOptions = match read_format_string_options(&mut test_config_file)
            {
                Ok(o) => o,
                Err(e) => {
                    eprintln!("could not parse format config file: {}", e);
                    std::process::exit(2)
                }
            };
            match match_format_string_in_file(
                options.format.as_str(),
                options.file.as_str(),
                options.lines_to_test,
            ) {
                Ok(res) => match serde_json::to_string(&res) {
                    Ok(v) => {
                        println!("{}", v);
                        if status_updates {
                            duration_report(
                                start,
                                format!(
                                    "format checking {} lines",
                                    res.matching_lines + res.nonmatching_lines
                                ),
                            );
                        }
                    }
                    Err(e) => {
                        eprintln!("serializing result failed: {}", e);
                        std::process::exit(2)
                    }
                },
                Err(e) => {
                    eprintln!("could not match format string file: {}", e);
                    std::process::exit(2)
                }
            }
        }
    }
    fn handle_dlt_subcommand(
        matches: &clap::ArgMatches,
        start: std::time::Instant,
        status_updates: bool,
    ) {
        if matches.is_present("input") {
            let tag = matches.value_of("tag").expect("tag must be present");
            let file_name = matches.value_of("input").expect("input must be present");
            let source_file_size = match fs::metadata(file_name) {
                Ok(file_meta) => file_meta.len() as usize,
                Err(_) => {
                    eprintln!("could not find out size of source file");
                    std::process::exit(2);
                }
            };
            let file_path = path::PathBuf::from(file_name);
            let fallback_out = file_name.to_string() + ".out";
            let out_path = path::PathBuf::from(
                matches
                    .value_of("output")
                    .unwrap_or_else(|| fallback_out.as_str()),
            );
            let mapping_out_path: path::PathBuf =
                path::PathBuf::from(file_name.to_string() + ".map.json");
            let f = match fs::File::open(&file_path) {
                Ok(file) => file,
                Err(_) => {
                    eprintln!("could not open {:?}", file_path);
                    std::process::exit(2)
                }
            };

            let chunk_size = value_t_or_exit!(matches.value_of("chunk_size"), usize);
            let max_lines = value_t_or_exit!(matches.value_of("max_lines"), usize);
            let append: bool = matches.is_present("append");
            let stdout: bool = matches.is_present("stdout");
            match processor::create_index_and_mapping_dlt(processor::IndexingConfig {
                tag,
                max_lines,
                chunk_size,
                in_file: f,
                out_path: &out_path,
                append,
                source_file_size,
                to_stdout: stdout,
                status_updates,
            },
            dlt::DltFilterConfig {
                min_log_level: dlt::LogLevel::Error,
            },
            ) {
                Err(why) => {
                    eprintln!("couldn't process: {}", why);
                    std::process::exit(2)
                }
                Ok(chunks) => {
                    let _ = serialize_chunks(&chunks, &mapping_out_path);
                    let file_size_in_mb = source_file_size as f64 / 1024.0 / 1024.0;
                    if status_updates {
                        duration_report_throughput(
                            start,
                            format!("processing ~{} MB", file_size_in_mb.round()),
                            file_size_in_mb,
                            "MB".to_string(),
                        )
                    }
                }
            }
        }
    }
}

fn duration_report(start: std::time::Instant, report: String) {
    let elapsed = start.elapsed();
    let ms = elapsed.as_millis();
    let duration_in_s = ms as f64 / 1000.0;
    eprintln!("{} took {:.3}s!", report, duration_in_s);
}
fn duration_report_throughput(
    start: std::time::Instant,
    report: String,
    amount: f64,
    unit: String,
) {
    let elapsed = start.elapsed();
    let ms = elapsed.as_millis();
    let duration_in_s = ms as f64 / 1000.0;
    let amount_per_second: f64 = amount / duration_in_s;
    eprintln!(
        "{} took {:.3}s! ({:.3} {}/s)",
        report, duration_in_s, amount_per_second, unit
    );
}
