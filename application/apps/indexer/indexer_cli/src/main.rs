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
extern crate chrono;
extern crate dirs;
extern crate dlt;
extern crate indexer_base;
extern crate merging;
extern crate processor;

#[macro_use]
extern crate lazy_static;

use anyhow::{anyhow, Result};
use crossbeam_channel as cc;
use crossbeam_channel::unbounded;
use dlt::{
    dlt_file::export_as_dlt_file, dlt_parse::StatisticsResults, dlt_pcap::pcap_to_dlt,
    fibex::FibexMetadata,
};
use indexer_base::{
    chunks::{serialize_chunks, Chunk, ChunkResults, VoidResults},
    config::*,
    error_reporter::*,
    export::export_file_line_based,
    progress::IndexingResults,
};
use indicatif::{ProgressBar, ProgressStyle};
use merging::merger::merge_files_use_config_file;
use std::rc::Rc;
use tokio::sync;

lazy_static! {
    static ref EXAMPLE_FIBEX: std::path::PathBuf =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dlt/tests/dlt-messages.xml");
}

#[macro_use]
extern crate clap;

#[macro_use]
extern crate log;
use clap::{App, Arg, SubCommand};
use indexer_base::progress::{IndexingProgress, Notification, Severity};
use processor::{
    grabber::LineRange,
    parse::{
        detect_timestamp_in_string, line_matching_format_expression, match_format_string_in_file,
        posix_timestamp_as_string, read_format_string_options, timespan_in_files, DiscoverItem,
        FormatTestOptions, TimestampFormatResult,
    },
};
use std::{fs, io::Read, path, time::Instant};

use std::thread;

fn init_logging() -> Result<()> {
    let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
    let log_config_path = home_dir.join(".chipmunk").join("log4rs.yaml");
    if !log_config_path.exists() {
        let log_config_content = std::include_str!("../log4rs.yaml")
            .replace("$HOME_DIR", &home_dir.to_string_lossy()[..]);
        std::fs::write(&log_config_path, log_config_content)?;
    }
    log4rs::init_file(log_config_path, Default::default())
        .expect("init logging with file did not work");
    info!("logging initialized");
    Ok(())
}

#[tokio::main]
pub async fn main() -> Result<()> {
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
            SubCommand::with_name("grab")
                .about("command for grabbing part of a file")
                .arg(
                    Arg::with_name("input")
                        .short("i")
                        .long("input")
                        .help("Sets the input file path")
                        .required(true)
                        .index(1),
                )
                .arg(
                    Arg::with_name("export")
                        .short("e")
                        .long("export")
                        .help("export metadata to file"),
                )
                .arg(
                    Arg::with_name("metadata")
                        .short("m")
                        .long("meta")
                        .value_name("META")
                        .help("slot metadata"),
                )
                .arg(
                    Arg::with_name("start")
                        .short("s")
                        .long("start")
                        .value_name("START")
                        .help("start index")
                        .required(true),
                )
                .arg(
                    Arg::with_name("length")
                        .short("x")
                        .long("length")
                        .value_name("END")
                        .help("end index")
                        .required(true),
                ),
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
                    Arg::with_name("watch")
                        .short("u")
                        .long("watch")
                        .help("tail the file (keep watching for updates)"),
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
            SubCommand::with_name("export")
                .about("test exorting files")
                .arg(
                    Arg::with_name("file")
                        .short("f")
                        .long("file")
                        .help("the file to export")
                        .required(true)
                        .index(1),
                )
                .arg(
                    Arg::with_name("sections")
                        .short("s")
                        .long("sections")
                        .value_name("SECTIONS")
                        .help("what sections to export, e.g. \"0,3|6,100\"")
                        .required(false)
                        .default_value(""),
                )
                .arg(
                    Arg::with_name("is_session_file")
                        .short("x")
                        .long("sessionfile")
                        .help("eliminiate session file quirks"),
                )
                .arg(
                    Arg::with_name("target")
                        .short("t")
                        .long("out")
                        .value_name("OUT")
                        .help("Output file, \"<file_to_export>.out\" if not present"),
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
                .about("handling dlt input")
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
            SubCommand::with_name("dlt-pcap")
                .about("dlt from pcap files")
                .arg(
                    Arg::with_name("input")
                        .short("i")
                        .long("input")
                        .help("the pcap file to parse")
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
                    Arg::with_name("chunk_size")
                        .short("c")
                        .long("chunk_size")
                        .help("How many lines should be in a chunk (used for access later)")
                        .required(false)
                        .default_value("500"),
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
                    Arg::with_name("filter_config")
                        .short("f")
                        .long("filter")
                        .value_name("FILTER_CONFIG")
                        .help("json file that defines dlt filter settings"),
                )
                .arg(
                    Arg::with_name("convert")
                        .short("n")
                        .long("convert")
                        .help("convert file to dlt format"),
                ),
        )
        .subcommand(
            SubCommand::with_name("dlt-udp")
                .about("handling dlt udp input")
                .arg(
                    Arg::with_name("ip")
                        .short("i")
                        .long("ip")
                        .help("the ip address + port")
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
                    Arg::with_name("chunk_size")
                        .short("c")
                        .long("chunk_size")
                        .help("How many lines should be in a chunk (used for access later)")
                        .required(false)
                        .default_value("500"),
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
        handle_merge_subcommand(matches, start).await
    } else if let Some(matches) = matches.subcommand_matches("grab") {
        handle_grab_subcommand(matches, start, use_stderr_for_status_updates)
            .await
            .expect("could not handle grab command")
    } else if let Some(matches) = matches.subcommand_matches("index") {
        handle_index_subcommand(matches, start, use_stderr_for_status_updates).await
    } else if let Some(matches) = matches.subcommand_matches("format") {
        handle_format_subcommand(matches, start, use_stderr_for_status_updates).await
    } else if let Some(matches) = matches.subcommand_matches("export") {
        handle_export_subcommand(matches, start).await
    } else if let Some(matches) = matches.subcommand_matches("dlt") {
        handle_dlt_subcommand(matches, start).await
    } else if let Some(matches) = matches.subcommand_matches("dlt-pcap") {
        handle_dlt_pcap_subcommand(matches).await
    } else if let Some(matches) = matches.subcommand_matches("dlt-udp") {
        handle_dlt_udp_subcommand(matches).await
    } else if let Some(matches) = matches.subcommand_matches("dlt-stats") {
        handle_dlt_stats_subcommand(matches, start, use_stderr_for_status_updates).await
    } else if let Some(matches) = matches.subcommand_matches("discover") {
        handle_discover_subcommand(matches).await
    }

    async fn handle_grab_subcommand(
        matches: &clap::ArgMatches<'_>,
        _start_time: std::time::Instant,
        _status_updates: bool,
    ) -> Result<()> {
        let input_path_string_res = value_t!(matches.value_of("input"), String);
        let start_res = value_t!(matches.value_of("start"), u64);
        let length_res = value_t!(matches.value_of("length"), u64);
        match (input_path_string_res, start_res, length_res) {
            (Ok(input_path), Ok(start), Ok(length)) => {
                println!(
                    "read file: {} from {} -> {}",
                    input_path,
                    start,
                    start + length
                );

                let start_op = Instant::now();

                let input_p = path::PathBuf::from(input_path);
                let grabber = if matches.is_present("metadata") {
                    let metadata_path =
                        matches.value_of("metadata").expect("input must be present");
                    println!("grabber with metadata");
                    processor::grabber::Grabber::lazy(&input_p, "sourceA")?
                        .load_metadata(path::PathBuf::from(metadata_path))?
                } else {
                    processor::grabber::Grabber::new(&input_p, "sourceA")?
                };

                duration_report(start_op, "initializing Grabber".to_string());

                let export: bool = matches.is_present("export");
                if export {
                    let start_op = Instant::now();
                    if let Some(export_folder_path) = input_p.parent() {
                        let mut export_path = std::path::PathBuf::from(export_folder_path);
                        export_path.push(format!(
                            "{}.metadata",
                            input_p
                                .file_name()
                                .unwrap_or_else(|| std::ffi::OsStr::new("export"))
                                .to_string_lossy()
                        ));
                        grabber
                            .export_slots(&export_path)
                            .expect("could not export metadata");
                    }
                    duration_report(start_op, "exporting metadata".to_string());
                }

                let start_op = Instant::now();
                let r = LineRange::new(start, start + length);
                let res = grabber.get_entries(&r);

                match res {
                    Ok(v) => {
                        duration_report(start_op, format!("grabbing {} lines", length));
                        let mut i = start;
                        for (cnt, s) in v.grabbed_elements.iter().enumerate() {
                            if s.content.len() > 50 {
                                println!("[{}]--> {}", i, &s.content[..50]);
                            } else {
                                println!("[{}]--> {}", i, &s.content);
                            }
                            i += 1;
                            if cnt > 15 {
                                println!("...{} more lines", v.grabbed_elements.len() - 15);
                                break;
                            }
                        }
                        Ok(())
                    }
                    Err(e) => {
                        report_error(format!("Error during line grabbing: {}", e));
                        std::process::exit(2);
                    }
                }
            }
            _ => {
                report_error("could not find out size of source file");
                std::process::exit(2);
            }
        }
    }

    async fn handle_index_subcommand(
        matches: &clap::ArgMatches<'_>,
        start: std::time::Instant,
        status_updates: bool,
    ) {
        if matches.is_present("input") && matches.is_present("tag") {
            let file = matches.value_of("input").expect("input must be present");
            let file_path = path::PathBuf::from(file);
            let tag = matches.value_of("tag").expect("tag must be present");
            let total = fs::metadata(file).expect("file size error").len();
            let progress_bar = initialize_progress_bar(total);
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

            let source_file_size = match fs::metadata(file) {
                Ok(file_meta) => file_meta.len(),
                Err(_) => {
                    report_error("could not find out size of source file");
                    std::process::exit(2);
                }
            };
            let append: bool = matches.is_present("append");
            let watch: bool = matches.is_present("watch");
            let timestamps: bool = matches.is_present("timestamp");
            let (tx, rx): (
                cc::Sender<IndexingResults<Chunk>>,
                cc::Receiver<ChunkResults>,
            ) = unbounded();

            let _h = tokio::spawn(async move {
                match processor::processor::create_index_and_mapping(
                    IndexingConfig {
                        tag: tag_string,
                        chunk_size,
                        in_file: file_path,
                        out_path,
                        append,
                        watch,
                    },
                    source_file_size,
                    timestamps,
                    tx,
                    None,
                )
                .await
                {
                    Err(why) => {
                        report_error(format!("couldn't process: {}", why));
                        std::process::exit(2)
                    }
                    Ok(()) => (),
                }
            });
            loop {
                let mut chunks: Vec<Chunk> = vec![];
                match rx.recv() {
                    Ok(Ok(IndexingProgress::Finished)) => {
                        trace!("finished...");
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
                        progress_bar.finish_and_clear();
                        break;
                    }
                    Ok(Ok(IndexingProgress::Progress { ticks })) => {
                        let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
                        trace!("progress... ({:.0} %)", progress_fraction * 100.0);
                        progress_bar.set_position((progress_fraction * (total as f64)) as u64);
                    }
                    Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
                        chunks.push(chunk);
                    }
                    Ok(Err(Notification {
                        severity,
                        content,
                        line,
                    })) => {
                        if severity == Severity::WARNING {
                            report_warning_ln(content, line);
                        } else {
                            report_error_ln(content, line);
                        }
                    }
                    Ok(Ok(IndexingProgress::Stopped)) => {
                        trace!("stopped...");
                        report_warning("IndexingProgress::Stopped");
                    }
                    Err(_) => {
                        report_error("couldn't process");
                        std::process::exit(2)
                    }
                }
            }
        }
    }

    async fn handle_merge_subcommand(matches: &clap::ArgMatches<'_>, _start: std::time::Instant) {
        debug!("handle_merge_subcommand");
        let merge_conf_path_string_res = value_t!(matches.value_of("merge_config"), String);
        let concat_conf_path_string_res = value_t!(matches.value_of("concat_config"), String);
        if let Ok(merge_conf_path_string) = merge_conf_path_string_res {
            let merge_conf_path = path::PathBuf::from(merge_conf_path_string);
            let append: bool = matches.is_present("append");
            let output_path_string = value_t_or_exit!(matches.value_of("output"), String);
            let out_path = path::PathBuf::from(output_path_string);
            let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
            let chunk_size = value_t_or_exit!(matches.value_of("chunk_size"), usize);

            let progress_bar = initialize_progress_bar(100 as u64);
            thread::spawn(move || {
                if let Err(why) = merge_files_use_config_file(
                    &merge_conf_path,
                    &out_path,
                    append,
                    chunk_size,
                    tx,
                    None,
                ) {
                    report_error(format!("couldn't process: {}", why));
                    std::process::exit(2)
                }
            });
            let mut chunks: Vec<Chunk> = vec![];
            loop {
                match rx.recv() {
                    Err(why) => {
                        report_error(format!("couldn't process: {}", why));
                        std::process::exit(2)
                    }
                    Ok(Ok(IndexingProgress::Finished { .. })) => {
                        println!("received finish event");
                        progress_bar.finish_and_clear();
                        break;
                    }
                    Ok(Ok(IndexingProgress::Progress { ticks })) => {
                        let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
                        let pos = (progress_fraction * 100f64) as u64;
                        progress_bar.set_position(pos);
                    }
                    Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
                        chunks.push(chunk);
                    }
                    Ok(Err(Notification {
                        severity,
                        content,
                        line,
                    })) => {
                        if severity == Severity::WARNING {
                            report_warning_ln(content, line);
                        } else {
                            report_error_ln(content, line);
                        }
                    }
                    Ok(_) => report_warning("process finished without result"),
                }
            }
        }
        if let Ok(concat_conf_path_string) = concat_conf_path_string_res {
            println!(
                "was concat call...NYI in main for config: {}",
                concat_conf_path_string
            );
        }

        println!("done with handle_dlt_subcommand");
        std::process::exit(0)
    }

    async fn handle_format_subcommand(
        matches: &clap::ArgMatches<'_>,
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
    fn to_pair(input: &str) -> Result<IndexSection> {
        let elems: Vec<&str> = input.split(',').collect();
        if elems.len() != 2 {
            return Err(anyhow!("no valid section element"));
        }
        Ok(IndexSection {
            first_line: elems[0].parse()?,
            last_line: elems[1].parse()?,
        })
    }
    async fn handle_export_subcommand(matches: &clap::ArgMatches<'_>, _start: std::time::Instant) {
        debug!("handle_export_subcommand");

        if let Some(file_name) = matches.value_of("file") {
            let fallback_out = file_name.to_string() + ".out";
            let out_path = path::PathBuf::from(
                matches
                    .value_of("output")
                    .unwrap_or_else(|| fallback_out.as_str()),
            );
            let file_path = path::PathBuf::from(file_name);
            let was_session_file: bool = matches.is_present("is_session_file");
            let sections_string = value_t_or_exit!(matches.value_of("sections"), String);
            let sections: Vec<IndexSection> = sections_string
                .split('|')
                .map(|s| to_pair(s).expect("could not parse section pair"))
                .collect();

            let (tx, _rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
            let ending = &file_path.extension().expect("could not get extension");
            if ending.to_str() == Some("dlt") {
                trace!("was dlt file");
                export_as_dlt_file(file_path, out_path, SectionConfig { sections }, tx)
                    .expect("export did not work");
            } else {
                trace!("was regular file");
                export_file_line_based(
                    file_path,
                    out_path,
                    SectionConfig { sections },
                    was_session_file,
                    tx,
                )
                .expect("export did not work");
            };

            println!("done with handle_export_subcommand");
            std::process::exit(0)
        }
    }
    async fn handle_dlt_subcommand(matches: &clap::ArgMatches<'_>, start: std::time::Instant) {
        debug!("handle_dlt_subcommand");
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
            let source_file_size = match fs::metadata(file_name) {
                Ok(file_meta) => file_meta.len(),
                Err(_) => {
                    report_error("could not find out size of source file");
                    std::process::exit(2);
                }
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

            let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
            let chunk_size = value_t_or_exit!(matches.value_of("chunk_size"), usize);
            let tag_string = tag.to_string();

            // let filter_config: Option<dlt::filtering::ProcessedDltFilterConfig> =
            //     filter_conf.map(dlt::filtering::process_filter_config);
            // let dlt_file_future = parse_dlt_file(file_path, filter_config, None);
            // let res = task::block_on(dlt_file_future);

            let progress_bar = initialize_progress_bar(source_file_size as u64);
            thread::spawn(move || {
                if let Err(why) = dlt::dlt_file::create_index_and_mapping_dlt(
                    IndexingConfig {
                        tag: tag_string,
                        chunk_size,
                        in_file: file_path,
                        out_path,
                        append,
                        watch: false,
                    },
                    source_file_size,
                    filter_conf,
                    &tx,
                    None,
                    // dlt::filtering::DltFilterConfig {
                    //     min_log_level: verbosity_log_level,
                    //     components: None,
                    // },
                    load_test_fibex(),
                ) {
                    report_error(format!("couldn't process: {}", why));
                    std::process::exit(2)
                }
            });
            let mut chunks: Vec<Chunk> = vec![];
            loop {
                match rx.recv() {
                    Err(why) => {
                        report_error(format!("couldn't process: {}", why));
                        std::process::exit(2)
                    }
                    Ok(Ok(IndexingProgress::Finished { .. })) => {
                        let _ = serialize_chunks(&chunks, &mapping_out_path);
                        let file_size_in_mb = source_file_size as f64 / 1024.0 / 1024.0;
                        duration_report_throughput(
                            start,
                            format!("processing ~{} MB", file_size_in_mb.round()),
                            file_size_in_mb,
                            "MB".to_string(),
                        );
                        println!("received finish event");
                        progress_bar.finish_and_clear();
                        break;
                    }
                    Ok(Ok(IndexingProgress::Progress { ticks })) => {
                        let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
                        let pos = (progress_fraction * (source_file_size as f64)) as u64;
                        progress_bar.set_position(pos);
                    }
                    Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
                        chunks.push(chunk);
                    }
                    Ok(Err(Notification {
                        severity,
                        content,
                        line,
                    })) => {
                        if severity == Severity::WARNING {
                            report_warning_ln(content, line);
                        } else {
                            report_error_ln(content, line);
                        }
                    }
                    Ok(_) => report_warning("process finished without result"),
                }
            }

            println!("done with handle_dlt_subcommand");
            std::process::exit(0)
        }
    }

    async fn handle_dlt_pcap_subcommand(matches: &clap::ArgMatches<'_>) {
        debug!("handle_dlt_pcap_subcommand");
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
            let fallback_out = file_name.to_string() + ".out";
            let out_path = path::PathBuf::from(
                matches
                    .value_of("output")
                    .unwrap_or_else(|| fallback_out.as_str()),
            );
            let file_path = path::PathBuf::from(file_name);
            let mapping_out_path: path::PathBuf =
                path::PathBuf::from(file_name.to_string() + ".map.json");

            let chunk_size = value_t_or_exit!(matches.value_of("chunk_size"), usize);
            let tag_string = tag.to_string();
            let total = fs::metadata(&file_path).expect("file size error").len();
            let progress_bar = initialize_progress_bar(total);
            let in_one_go: bool = matches.is_present("convert");
            let shutdown_channel = sync::mpsc::channel(1);
            if in_one_go {
                let (tx, rx): (cc::Sender<VoidResults>, cc::Receiver<VoidResults>) = unbounded();
                thread::spawn(move || {
                    let res = pcap_to_dlt(
                        &file_path,
                        &out_path,
                        filter_conf,
                        tx,
                        shutdown_channel.1,
                        load_test_fibex_rc(),
                    );

                    if let Err(reason) = res {
                        report_error(format!("couldn't convert: {}", reason));
                        std::process::exit(2)
                    }
                });
                loop {
                    match rx.recv() {
                        Err(why) => {
                            report_error(format!("couldn't process: {}", why));
                            std::process::exit(2)
                        }
                        Ok(Ok(IndexingProgress::Finished { .. })) => {
                            progress_bar.finish_and_clear();
                            break;
                        }
                        Ok(Ok(IndexingProgress::Progress { ticks })) => {
                            let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
                            trace!("progress... ({:.0} %)", progress_fraction * 100.0);
                            progress_bar.set_position((progress_fraction * (total as f64)) as u64);
                        }
                        Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
                            println!("Invalid chunk received {:?}", chunk);
                        }
                        Ok(Err(Notification {
                            severity,
                            content,
                            line,
                        })) => {
                            if severity == Severity::WARNING {
                                report_warning_ln(content, line);
                            } else {
                                report_error_ln(content, line);
                            }
                        }
                        Ok(_) => report_warning("process finished without result"),
                    }
                }
            } else {
                let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
                thread::spawn(move || {
                    let res = dlt::dlt_pcap::create_index_and_mapping_dlt_from_pcap(
                        IndexingConfig {
                            tag: tag_string,
                            chunk_size,
                            in_file: file_path,
                            out_path,
                            append,
                            watch: false,
                        },
                        filter_conf,
                        &tx,
                        shutdown_channel.1,
                        load_test_fibex_rc(),
                    );

                    if let Err(reason) = res {
                        report_error(format!("couldn't process: {}", reason));
                        std::process::exit(2)
                    }
                });
                let mut chunks: Vec<Chunk> = vec![];
                loop {
                    match rx.recv() {
                        Err(why) => {
                            report_error(format!("couldn't process: {}", why));
                            std::process::exit(2)
                        }
                        Ok(Ok(IndexingProgress::Finished { .. })) => {
                            let _ = serialize_chunks(&chunks, &mapping_out_path);
                            progress_bar.finish_and_clear();
                            break;
                        }
                        Ok(Ok(IndexingProgress::Progress { ticks })) => {
                            let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
                            trace!("progress... ({:.0} %)", progress_fraction * 100.0);
                            progress_bar.set_position((progress_fraction * (total as f64)) as u64);
                        }
                        Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
                            println!("{:?}", chunk);
                            chunks.push(chunk);
                        }
                        Ok(Err(Notification {
                            severity,
                            content,
                            line,
                        })) => {
                            if severity == Severity::WARNING {
                                report_warning_ln(content, line);
                            } else {
                                report_error_ln(content, line);
                            }
                        }
                        Ok(_) => report_warning("process finished without result"),
                    }
                }
            }

            println!("done with handle_dlt_pcap_subcommand");
            std::process::exit(0)
        }
    };
    async fn handle_dlt_udp_subcommand(matches: &clap::ArgMatches<'_>) {
        debug!("handle_dlt_udp_subcommand");
        if let (Some(ip_address), Some(tag), Some(output)) = (
            matches.value_of("ip"),
            matches.value_of("tag"),
            matches.value_of("output"),
        ) {
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
            let out_path = path::PathBuf::from(output);
            let mapping_out_path: path::PathBuf =
                path::PathBuf::from(output.to_string() + ".map.json");

            let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
            let shutdown_channel = sync::mpsc::channel(1);
            let tag_string = tag.to_string();
            let multicast_conf = MulticastInfo {
                multiaddr: ip_address.to_string(),
                interface: None,
            };
            let socket_conf = SocketConfig {
                multicast_addr: Some(multicast_conf),
                bind_addr: "0.0.0.0".to_string(),
                port: "8888".to_string(),
            };

            use chrono::Local;
            let now = Local::now();
            let session_id = format!("dlt_session_id_{}.dlt", now.format("%Y%b%d_%H-%M-%S"));
            use tokio::runtime::Runtime;
            // Create the runtime
            let rt = Runtime::new().expect("Could not create runtime");
            // TODO rework without thread::spawn
            thread::spawn(move || {
                let dlt_socket_future = dlt::dlt_net::create_index_and_mapping_dlt_from_socket(
                    session_id,
                    socket_conf,
                    tag_string.as_str(),
                    &out_path,
                    filter_conf,
                    &tx,
                    shutdown_channel.1,
                    load_test_fibex(),
                );

                let why = rt.block_on(dlt_socket_future);
                if let Err(reason) = why {
                    report_error(format!("couldn't process: {}", reason));
                    std::process::exit(2)
                }
            });
            let mut chunks: Vec<Chunk> = vec![];
            loop {
                match rx.recv() {
                    Err(why) => {
                        report_error(format!("couldn't process: {}", why));
                        std::process::exit(2)
                    }
                    Ok(Ok(IndexingProgress::Finished { .. })) => {
                        let _ = serialize_chunks(&chunks, &mapping_out_path);
                        break;
                    }
                    Ok(Ok(IndexingProgress::Progress { ticks })) => {
                        let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
                        trace!("progress... ({:.0} %)", progress_fraction * 100.0);
                    }
                    Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
                        println!("{:?}", chunk);
                        chunks.push(chunk);
                    }
                    Ok(Err(Notification {
                        severity,
                        content,
                        line,
                    })) => {
                        if severity == Severity::WARNING {
                            report_warning_ln(content, line);
                        } else {
                            report_error_ln(content, line);
                        }
                    }
                    Ok(_) => report_warning("process finished without result"),
                }
            }

            println!("done with handle_dlt_udp_subcommand");
            std::process::exit(0)
        }
    }

    async fn handle_discover_subcommand(matches: &clap::ArgMatches<'_>) {
        if let Some(test_string) = matches.value_of("input-string") {
            match detect_timestamp_in_string(test_string, None) {
                Ok((timestamp, _, _)) => println!(
                    "detected timestamp: {}",
                    posix_timestamp_as_string(timestamp)
                ),
                Err(e) => println!("no timestamp found in {} ({})", test_string, e),
            }
        } else if let Some(file_name) = matches.value_of("input-file") {
            let file_name_string = file_name.to_string();

            let (tx, rx): (
                cc::Sender<IndexingResults<TimestampFormatResult>>,
                cc::Receiver<IndexingResults<TimestampFormatResult>>,
            ) = unbounded();
            let items: Vec<DiscoverItem> = vec![DiscoverItem {
                path: file_name_string,
                format_string: None,
                fallback_year: None,
            }];

            let progress_bar = initialize_progress_bar(100);
            thread::spawn(move || {
                match timespan_in_files(items, &tx) {
                    Ok(()) => (),
                    Err(e) => {
                        report_error(format!("executed with error: {}", e));
                        std::process::exit(2)
                    }
                };
            });
            loop {
                match rx.recv() {
                    Ok(Ok(IndexingProgress::GotItem { item: res })) => {
                        match serde_json::to_string(&res) {
                            Ok(stats) => println!("{}", stats),
                            Err(e) => {
                                report_error(format!("serializing result {:?} failed: {}", res, e));
                                std::process::exit(2)
                            }
                        }
                    }
                    Ok(Ok(IndexingProgress::Progress { ticks: t })) => {
                        let progress_fraction = t.0 as f64 / t.1 as f64;
                        trace!("progress... ({:.1} %)", progress_fraction * 100.0);
                        progress_bar.set_position((progress_fraction * 100.0) as u64);
                    }
                    Ok(Ok(IndexingProgress::Finished)) => {
                        trace!("finished...");
                        progress_bar.finish_and_clear();
                        break;
                    }
                    Ok(Err(Notification {
                        severity,
                        content,
                        line,
                    })) => {
                        if severity == Severity::WARNING {
                            report_warning_ln(content, line);
                        } else {
                            report_error_ln(content, line);
                        }
                    }
                    Ok(Ok(IndexingProgress::Stopped)) => {
                        trace!("stopped...");
                        break;
                    }
                    Err(e) => {
                        report_error(format!("couldn't process: {}", e));
                        std::process::exit(2)
                    }
                }
            }
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
            println!("discover for: {:?}", contents);
            let items: Vec<DiscoverItem> = match serde_json::from_str(&contents[..]) {
                Ok(items) => items,
                Err(e) => {
                    report_error(format!("could not read discover config {}", e));
                    std::process::exit(2)
                }
            };
            let mut results: Vec<TimestampFormatResult> = Vec::new();
            let (tx, rx): (
                cc::Sender<IndexingResults<TimestampFormatResult>>,
                cc::Receiver<IndexingResults<TimestampFormatResult>>,
            ) = unbounded();

            let progress_bar = initialize_progress_bar(100);
            thread::spawn(move || {
                match timespan_in_files(items, &tx) {
                    Ok(()) => (),
                    Err(e) => {
                        report_error(format!("executed with error: {}", e));
                        std::process::exit(2)
                    }
                };
            });
            loop {
                match rx.recv() {
                    Ok(Ok(IndexingProgress::GotItem { item: res })) => {
                        results.push(res);
                    }
                    Ok(Ok(IndexingProgress::Progress { ticks: t })) => {
                        let progress_fraction = t.0 as f64 / t.1 as f64;
                        trace!("progress... ({:.1} %)", progress_fraction * 100.0);
                        progress_bar.set_position((progress_fraction * 100.0) as u64);
                    }
                    Ok(Ok(IndexingProgress::Finished)) => {
                        trace!("finished...");
                        progress_bar.finish_and_clear();
                        break;
                    }
                    Ok(Err(Notification {
                        severity,
                        content,
                        line,
                    })) => {
                        println!("received Notification");
                        if severity == Severity::WARNING {
                            report_warning_ln(content, line);
                        } else {
                            report_error_ln(content, line);
                        }
                    }
                    Ok(Ok(IndexingProgress::Stopped)) => {
                        trace!("stopped...");
                        break;
                    }
                    Err(_) => {
                        report_error("couldn't process");
                        std::process::exit(2)
                    }
                }
            }
            let json = serde_json::to_string(&results).unwrap_or_else(|_| "".to_string());
            println!("printing our results");
            println!("{}", json);
        }
    }

    async fn handle_dlt_stats_subcommand(
        matches: &clap::ArgMatches<'_>,
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
        let progress_bar = initialize_progress_bar(source_file_size as u64);
        let (tx, rx): (
            cc::Sender<StatisticsResults>,
            cc::Receiver<StatisticsResults>,
        ) = unbounded();

        thread::spawn(move || {
            if let Err(why) = dlt::dlt_parse::get_dlt_file_info(&file_path, &tx, None) {
                report_error(format!("couldn't collect statistics: {}", why));
                std::process::exit(2)
            }
        });
        loop {
            match rx.recv() {
                Ok(Ok(IndexingProgress::GotItem { item: res })) => {
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
                Ok(Ok(IndexingProgress::Progress { ticks: t })) => {
                    let progress_fraction = t.0 as f64 / t.1 as f64;
                    trace!("progress... ({:.1} %)", progress_fraction * 100.0);
                    progress_bar
                        .set_position((progress_fraction * (source_file_size as f64)) as u64);
                }
                Ok(Ok(IndexingProgress::Finished)) => {
                    trace!("finished...");
                    progress_bar.finish_and_clear();
                    break;
                }
                Ok(Err(Notification {
                    severity,
                    content,
                    line,
                })) => {
                    if severity == Severity::WARNING {
                        report_warning_ln(content, line);
                    } else {
                        report_error_ln(content, line);
                    }
                }
                Ok(Ok(IndexingProgress::Stopped)) => {
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
    Ok(())
}

fn duration_report(start: std::time::Instant, report: String) {
    let elapsed = start.elapsed();
    let us = elapsed.as_micros();
    if us > 1000 {
        let ms = elapsed.as_millis();
        if ms > 1000 {
            let duration_in_s = ms as f64 / 1000.0;
            eprintln!("{} took {:.3}s!", report, duration_in_s);
        } else {
            eprintln!("{} took {:.3}ms!", report, ms);
        }
    } else {
        eprintln!("{} took {:.3}us!", report, us);
    }
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
fn load_test_fibex_rc() -> Option<Rc<FibexMetadata>> {
    load_test_fibex().map(std::rc::Rc::new)
}
fn load_test_fibex() -> Option<FibexMetadata> {
    Some(
        dlt::fibex::read_fibexes(vec![EXAMPLE_FIBEX.clone()]).unwrap_or_else(|_e| {
            report_error(format!("could not open {:?}", EXAMPLE_FIBEX.clone()));
            std::process::exit(3);
        }),
    )
}
fn initialize_progress_bar(len: u64) -> ProgressBar {
    let progress_bar = ProgressBar::new(len);
    progress_bar.set_style(ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
                .progress_chars("#>-"));
    progress_bar
}
