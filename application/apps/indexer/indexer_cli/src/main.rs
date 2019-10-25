// Copyright (c) 2019 E.S.R.Labs. All rights reserved.
//
// NOTICE:  All information contained herein is, and remains
// the property of E.S.R.Labs and its suppliers, if any.
// The intellectual and technical concepts contained herein are
// proprietary to E.S.R.Labs and its suppliers and may be covered
// by German and Foreign Patents, patents in process, and are protected
// by trade secret or copyright law.
// Dissemination of this information or reproduction of this material
// is strictly forbidden unless prior written permission is obtained
// from E.S.R.Labs.
extern crate processor;
extern crate indexer_base;
extern crate dlt;
extern crate merging;
extern crate chrono;
extern crate dirs;

use indexer_base::chunks::{serialize_chunks, Chunk};
use indexer_base::config::IndexingConfig;
use indexer_base::error_reporter::*;

#[macro_use]
extern crate clap;

#[macro_use]
extern crate log;
use clap::{App, Arg, SubCommand};
use std::fs;
use std::io::{Read};
use std::path;
use std::time::Instant;
use processor::parse::posix_timestamp_as_string;
use processor::parse::detect_timestamp_in_string;
use processor::parse::detect_timestamp_format_in_file;
use processor::parse::timespan_in_file;
use processor::parse::{
    line_matching_format_expression, match_format_string_in_file, read_format_string_options,
    FormatTestOptions, DiscoverItem, TimestampFormatResult,
};
use indexer_base::progress::IndexingProgress;
use std::sync::mpsc::{Sender, Receiver};
use log::LevelFilter;
use log4rs::append::file::FileAppender;
use log4rs::config::{Appender, Config, Root};
use log4rs::encode::pattern::PatternEncoder;
use std::io::Result;
use dlt::dlt_parse::StatisticInfo;
use std::thread;

fn init_logging() -> Result<()> {
    let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
    let log_path = home_dir.join(".logviewer").join("chipmunk.indexer.log");
    let appender_name = "indexer-root";
    let logfile = FileAppender::builder()
        .encoder(Box::new(PatternEncoder::new("{d} - {l}:: {m}\n")))
        .build(log_path)?;

    let config = Config::builder()
        .appender(Appender::builder().build(appender_name, Box::new(logfile)))
        .build(
            Root::builder()
                .appender(appender_name)
                .build(LevelFilter::Trace),
        )
        .unwrap();

    log4rs::init_config(config).unwrap();

    Ok(())
}
fn main() {
    init_logging().expect("logging has to be in place");
    let start = Instant::now();
    let matches = App::new("chip")
        .version(crate_version!())
        .author(crate_authors!())
        .about("Create index file and mapping file for chipmunk")
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
                    Arg::with_name("timestamp")
                        .short("w")
                        .help("add timestamp info if available"),
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
                .about("command for merging/concatenating multiple log files")
                .arg(
                    Arg::with_name("merge_config")
                        .short("m")
                        .long("merge")
                        .help("json file that defines all files to be merged")
                        .value_name("MERGE_CONFIG")
                        .required_unless("concat_config"),
                )
                .arg(
                    Arg::with_name("concat_config")
                        .short("j")
                        .long("concat")
                        .help("json file that defines all files to be concatenated")
                        .value_name("CONCAT_CONFIG")
                        .required_unless("merge_config"),
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
            SubCommand::with_name("discover")
                .about("test date discovery, either from a string or from a file")
                .arg(
                    Arg::with_name("input-string")
                        .short("i")
                        .help("string to extract date from")
                        .long("input")
                        .value_name("INPUT")
                        .required_unless_one(&["config-file", "input-file"])
                        .conflicts_with_all(&["config-file", "input-file"]),
                )
                .arg(
                    Arg::with_name("config-file")
                        .short("c")
                        .help("file that contains a list of files to analyze")
                        .long("config")
                        .value_name("CONFIG")
                        .required_unless_one(&["input-file", "input-string"])
                        .conflicts_with_all(&["input-file", "input-string"]),
                )
                .arg(
                    Arg::with_name("input-file")
                        .takes_value(true)
                        .conflicts_with_all(&["config-file", "input-string"])
                        .required_unless_one(&["config-file", "input-string"])
                        .short("f")
                        .help("file where the timeformat should be detected")
                        .long("file"),
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
                        .long("chunk_size")
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
                    Arg::with_name("filter_config")
                        .short("f")
                        .long("filter")
                        .value_name("FILTER_CONFIG")
                        .help("json file that defines dlt filter settings"),
                )
                .arg(
                    Arg::with_name("stdout")
                        .short("s")
                        .long("stdout")
                        .help("put out chunk information on stdout"),
                ),
        )
        .subcommand(
            SubCommand::with_name("dlt-stats")
                .about("dlt statistics")
                .arg(
                    Arg::with_name("input")
                        .short("i")
                        .long("input")
                        .help("the DLT file to parse")
                        .required(true)
                        .index(1),
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
    } else if let Some(matches) = matches.subcommand_matches("dlt-stats") {
        handle_dlt_stats_subcommand(matches, start, use_stderr_for_status_updates)
    } else if let Some(matches) = matches.subcommand_matches("discover") {
        handle_discover_subcommand(matches)
    }

    fn handle_index_subcommand(
        matches: &clap::ArgMatches,
        start: std::time::Instant,
        status_updates: bool,
    ) {
        if matches.is_present("input") && matches.is_present("tag") {
            let file = matches.value_of("input").expect("input must be present");
            let tag = matches.value_of("tag").expect("tag must be present");
            let tag_string = tag.to_string();
            let fallback_out = file.to_string() + ".out";
            let out_path = path::PathBuf::from(
                matches
                    .value_of("output")
                    .unwrap_or_else(|| fallback_out.as_str()),
            );
            let mapping_out_path: path::PathBuf =
                path::PathBuf::from(file.to_string() + ".map.json");
            let chunk_size = value_t_or_exit!(matches.value_of("chunk_size"), usize);

            let f = match fs::File::open(&file) {
                Ok(file) => file,
                Err(_) => {
                    report_error(format!("could not open {}", file));
                    std::process::exit(2)
                }
            };

            let source_file_size = if status_updates {
                Some(match fs::metadata(file) {
                    Ok(file_meta) => file_meta.len() as usize,
                    Err(_) => {
                        report_error("could not find out size of source file");
                        std::process::exit(2);
                    }
                })
            } else {
                None
            };
            let append: bool = matches.is_present("append");
            let stdout: bool = matches.is_present("stdout");
            let timestamps: bool = matches.is_present("timestamp");
            let (tx, rx): (
                Sender<IndexingProgress<Chunk>>,
                Receiver<IndexingProgress<Chunk>>,
            ) = std::sync::mpsc::channel();

            let handle =
                thread::spawn(move || {
                    match processor::processor::create_index_and_mapping(
                        IndexingConfig {
                            tag: tag_string.as_str(),
                            chunk_size,
                            in_file: f,
                            out_path: &out_path,
                            append,
                            to_stdout: stdout,
                        },
                        timestamps,
                        source_file_size,
                        tx,
                        None,
                    ) {
                        Err(why) => {
                            report_error(format!("couldn't process: {}", why));
                            std::process::exit(2)
                        }
                        Ok(()) => (),
                    }
                });
            match handle.join() {
                Ok(()) => loop {
                    trace!("looping...");
                    let mut chunks: Vec<Chunk> = vec![];
                    match rx.recv() {
                        Ok(IndexingProgress::Finished { .. }) => {
                            trace!("finished...");
                            let _ = serialize_chunks(&chunks, &mapping_out_path);
                            if let Some(original_file_size) = source_file_size {
                                let file_size_in_mb = original_file_size as f64 / 1024.0 / 1024.0;
                                if status_updates {
                                    duration_report_throughput(
                                        start,
                                        format!("processing ~{} MB", file_size_in_mb.round()),
                                        file_size_in_mb,
                                        "MB".to_string(),
                                    )
                                }
                            }
                            break;
                        }
                        Ok(IndexingProgress::Progress { ticks: t }) => {
                            trace!("progress...");
                            report_warning(format!("IndexingProgress::Progress({:?})", t));
                        }
                        Ok(IndexingProgress::GotItem { item: chunk }) => {
                            trace!("got item...");
                            chunks.push(chunk);
                        }
                        Ok(IndexingProgress::Stopped) => {
                            trace!("stopped...");
                            report_warning("IndexingProgress::Stopped");
                        }
                        Err(_) => {
                            report_error("couldn't process");
                            std::process::exit(2)
                        }
                    }
                },
                Err(_) => {
                    report_error("couldn't process");
                    std::process::exit(2)
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
                    report_error("no output file specified");
                    std::process::exit(2)
                }
            };
            let chunk_size = value_t_or_exit!(matches.value_of("chunk_size"), usize);
            let append: bool = matches.is_present("append");
            let stdout: bool = matches.is_present("stdout");
            let merger = merging::merger::Merger {
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
                    report_error(format!("error merging: {}", e));
                    std::process::exit(2)
                }
            };
            if status_updates {
                duration_report(start, format!("merging {} lines", merged_lines));
            }
        } else if matches.is_present("concat_config") {
            let concat_config_file_name: &str = matches
                .value_of("concat_config")
                .expect("concat_config must be present");
            let out_path: path::PathBuf = match matches.value_of("output") {
                Some(path) => path::PathBuf::from(path),
                None => {
                    report_error("no output file specified");
                    std::process::exit(2)
                }
            };
            let chunk_size = value_t_or_exit!(matches.value_of("chunk_size"), usize);
            let append: bool = matches.is_present("append");
            let stdout: bool = matches.is_present("stdout");
            let concatenator = merging::concatenator::Concatenator {
                chunk_size, // used for mapping line numbers to byte positions
            };
            let config_path = path::PathBuf::from(concat_config_file_name);
            let merged_lines = match concatenator.concat_files_use_config_file(
                &config_path,
                &out_path,
                append,
                stdout,
                status_updates,
            ) {
                Ok(cnt) => cnt,
                Err(e) => {
                    report_error(format!("error merging: {}", e));
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
                    report_error(format!("error matching: {}", e));
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
                    report_error(format!("could not open {}", test_config_name));
                    std::process::exit(2)
                }
            };
            let options: FormatTestOptions = match read_format_string_options(&mut test_config_file)
            {
                Ok(o) => o,
                Err(e) => {
                    report_error(format!("could not parse format config file: {}", e));
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
                        report_error(format!("serializing result failed: {}", e));
                        std::process::exit(2)
                    }
                },
                Err(e) => {
                    report_error(format!("could not match format string file: {}", e));
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
        if let (Some(file_name), Some(tag)) = (matches.value_of("input"), matches.value_of("tag")) {
            let filter_conf: Option<dlt::filtering::DltFilterConfig> = match matches
                .value_of("filter_config")
            {
                Some(filter_config_file_name) => {
                    let config_path = path::PathBuf::from(filter_config_file_name);
                    let mut cnf_file = match fs::File::open(&config_path) {
                        Ok(file) => file,
                        Err(_) => {
                            report_error(format!("could not open filter config {:?}", config_path));
                            std::process::exit(2)
                        }
                    };
                    dlt::filtering::read_filter_options(&mut cnf_file).ok()
                }
                None => None,
            };
            let append: bool = matches.is_present("append");
            let stdout: bool = matches.is_present("stdout");
            let source_file_size = if status_updates {
                Some(match fs::metadata(file_name) {
                    Ok(file_meta) => file_meta.len() as usize,
                    Err(_) => {
                        report_error("could not find out size of source file");
                        std::process::exit(2);
                    }
                })
            } else {
                None
            };
            let fallback_out = file_name.to_string() + ".out";
            let out_path = path::PathBuf::from(
                matches
                    .value_of("output")
                    .unwrap_or_else(|| fallback_out.as_str()),
            );
            let file_path = path::PathBuf::from(file_name);
            let mapping_out_path: path::PathBuf =
                path::PathBuf::from(file_name.to_string() + ".map.json");
            let f = match fs::File::open(&file_path) {
                Ok(file) => file,
                Err(_) => {
                    report_error(format!("could not open {:?}", file_path));
                    std::process::exit(2)
                }
            };

            let (tx, rx): (
                Sender<IndexingProgress<Chunk>>,
                Receiver<IndexingProgress<Chunk>>,
            ) = std::sync::mpsc::channel();
            let chunk_size = value_t_or_exit!(matches.value_of("chunk_size"), usize);
            let tag_string = tag.to_string();
            let handle = thread::spawn(move || {
                if let Err(why) = dlt::dlt_parse::create_index_and_mapping_dlt(
                    IndexingConfig {
                        tag: tag_string.as_str(),
                        chunk_size,
                        in_file: f,
                        out_path: &out_path,
                        append,
                        to_stdout: stdout,
                    },
                    source_file_size,
                    filter_conf,
                    tx,
                    None,
                    // dlt::filtering::DltFilterConfig {
                    //     min_log_level: verbosity_log_level,
                    //     components: None,
                    // },
                ) {
                    report_error(format!("couldn't process: {}", why));
                    std::process::exit(2)
                }
            });
            let mut chunks: Vec<Chunk> = vec![];
            match handle.join() {
                Ok(()) => match rx.try_recv() {
                    Err(why) => {
                        report_error(format!("couldn't process: {}", why));
                        std::process::exit(2)
                    }
                    Ok(IndexingProgress::Finished { .. }) => {
                        let _ = serialize_chunks(&chunks, &mapping_out_path);
                        if let Some(original_file_size) = source_file_size {
                            let file_size_in_mb = original_file_size as f64 / 1024.0 / 1024.0;
                            duration_report_throughput(
                                start,
                                format!("processing ~{} MB", file_size_in_mb.round()),
                                file_size_in_mb,
                                "MB".to_string(),
                            )
                        }
                    }
                    Ok(IndexingProgress::GotItem { item: chunk }) => {
                        trace!("got item...");
                        chunks.push(chunk);
                    }
                    Ok(_) => report_warning("process finished without result"),
                },
                Err(why) => {
                    report_error(format!("couldn't process: {:?}", why));
                    std::process::exit(2)
                }
            }
            std::process::exit(0)
        }
    }

    fn handle_discover_subcommand(matches: &clap::ArgMatches) {
        if let Some(test_string) = matches.value_of("input-string") {
            match detect_timestamp_in_string(test_string, None) {
                Ok((timestamp, _, _)) => println!(
                    "detected timestamp: {}",
                    posix_timestamp_as_string(timestamp)
                ),
                Err(e) => println!("no timestamp found in {} ({})", test_string, e),
            }
        } else if let Some(file_name) = matches.value_of("input-file") {
            let file_path = path::PathBuf::from(file_name);
            let file_name_string = file_name.to_string();

            let handle = thread::spawn(move || match detect_timestamp_format_in_file(&file_path) {
                Ok(res) => {
                    let (min, max) = match timespan_in_file(&res, &file_path) {
                        Ok(span) => (
                            Some(posix_timestamp_as_string(span.0)),
                            Some(posix_timestamp_as_string(span.1)),
                        ),
                        _ => (None, None),
                    };
                    let timestamp_result = TimestampFormatResult {
                        path: file_name_string,
                        format: Some(res),
                        min_time: min,
                        max_time: max,
                    };
                    let json =
                        serde_json::to_string(&timestamp_result).unwrap_or_else(|_| "".to_string());
                    println!("{}", json);
                }
                Err(e) => {
                    let timestamp_result = TimestampFormatResult {
                        path: file_name_string,
                        format: None,
                        min_time: None,
                        max_time: None,
                    };
                    let json =
                        serde_json::to_string(&timestamp_result).unwrap_or_else(|_| "".to_string());
                    println!("{}", json);
                    report_error(format!("executed with error: {}", e))
                }
            });
        // match handle.join() {
        //     Ok(()) => match rx.try_recv() {
        //         Ok(IndexingProgress::Finished { result: chunks }) => {
        //             let _ = serialize_chunks(&chunks, &mapping_out_path);
        //             if let Some(original_file_size) = source_file_size {
        //                 let file_size_in_mb = original_file_size as f64 / 1024.0 / 1024.0;
        //                 if status_updates {
        //                     duration_report_throughput(
        //                         start,
        //                         format!("processing ~{} MB", file_size_in_mb.round()),
        //                         file_size_in_mb,
        //                         "MB".to_string(),
        //                     )
        //                 }
        //             }
        //         }
        //         Ok(_) => {
        //             report_warning("process finished without result");
        //         }
        //         Err(_) => {
        //             report_error("couldn't process");
        //             std::process::exit(2)
        //         }
        //     },
        //     Err(_) => {
        //         report_error("couldn't process");
        //         std::process::exit(2)
        //     }
        // }
        } else if let Some(file_name) = matches.value_of("config-file") {
            let config_file_path = path::PathBuf::from(file_name);
            let mut discover_config_file = match fs::File::open(&config_file_path) {
                Ok(file) => file,
                Err(_) => {
                    report_error(format!("could not open {:?}", config_file_path));
                    std::process::exit(2)
                }
            };
            let mut contents = String::new();
            discover_config_file
                .read_to_string(&mut contents)
                .expect("something went wrong reading the file");
            let items: Vec<DiscoverItem> = match serde_json::from_str(&contents[..]) {
                Ok(items) => items,
                Err(e) => {
                    report_error(format!("could not read discover config {}", e));
                    std::process::exit(2)
                }
            };
            let mut results: Vec<TimestampFormatResult> = Vec::new();
            for item in items {
                let file_path = path::PathBuf::from(&item.path);
                match detect_timestamp_format_in_file(&file_path) {
                    Ok(res) => {
                        let (min, max) = match timespan_in_file(&res, &file_path) {
                            Ok(span) => (
                                Some(posix_timestamp_as_string(span.0)),
                                Some(posix_timestamp_as_string(span.1)),
                            ),
                            _ => (None, None),
                        };
                        results.push(TimestampFormatResult {
                            path: item.path.to_string(),
                            format: Some(res),
                            min_time: min,
                            max_time: max,
                        })
                    }
                    Err(e) => {
                        results.push(TimestampFormatResult {
                            path: item.path.to_string(),
                            format: None,
                            min_time: None,
                            max_time: None,
                        });
                        report_error(format!("executed with error: {}", e))
                    }
                }
            }
            let json = serde_json::to_string(&results).unwrap_or_else(|_| "".to_string());
            println!("{}", json);
        }
    }

    fn handle_dlt_stats_subcommand(
        matches: &clap::ArgMatches,
        start: std::time::Instant,
        status_updates: bool,
    ) {
        let file_name = matches.value_of("input").expect("input must be present");
        let file_path = path::PathBuf::from(file_name);
        let f = match fs::File::open(&file_path) {
            Ok(file) => file,
            Err(_) => {
                report_error(format!("could not open {:?}", file_path));
                std::process::exit(2)
            }
        };
        let source_file_size = match f.metadata() {
            Ok(file_meta) => file_meta.len() as usize,
            Err(_) => {
                report_error("could not find out size of source file");
                std::process::exit(2);
            }
        };
        let (tx, rx): (
            Sender<IndexingProgress<StatisticInfo>>,
            Receiver<IndexingProgress<StatisticInfo>>,
        ) = std::sync::mpsc::channel();

        thread::spawn(move || {
            if let Err(why) = dlt::dlt_parse::get_dlt_file_info(&f, source_file_size, tx, None) {
                report_error(format!("couldn't collect statistics: {}", why));
                std::process::exit(2)
            }
        });
        loop {
            match rx.recv() {
                Ok(IndexingProgress::GotItem { item: res }) => {
                    trace!("got item...");

                    match serde_json::to_string(&res) {
                        Ok(stats) => println!("{}", stats),
                        Err(e) => {
                            report_error(format!("serializing result {:?} failed: {}", res, e));
                            std::process::exit(2)
                        }
                    }
                    if status_updates {
                        let file_size_in_mb = source_file_size as f64 / 1024.0 / 1024.0;
                        let elapsed = start.elapsed();
                        let ms = elapsed.as_millis();
                        let duration_in_s = ms as f64 / 1000.0;
                        eprintln!(
                            "collecting statistics for ~{} MB took {:.3}s!",
                            file_size_in_mb.round(),
                            duration_in_s
                        );
                    }
                }
                Ok(IndexingProgress::Progress { ticks: t }) => {
                    trace!("progress... ({:.1} %)", (t.0 as f64 / t.1 as f64) * 100.0);
                    report_warning(format!("IndexingProgress::Progress({:?})", t));
                }
                Ok(IndexingProgress::Finished) => {
                    trace!("finished...");
                    break;
                }
                Ok(IndexingProgress::Stopped) => {
                    trace!("stopped...");
                    report_warning("IndexingProgress::Stopped");
                    break;
                }
                Err(_) => {
                    report_error("couldn't process");
                    std::process::exit(2)
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
