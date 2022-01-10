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
use async_stream::stream;
use crossbeam_channel as cc;
use crossbeam_channel::unbounded;
use dlt::dlt_file::{export_as_dlt_file, StatisticsResults};
use dlt_core::{
    fibex::{gather_fibex_data, FibexConfig, FibexMetadata},
    filtering::{process_filter_config, read_filter_options, DltFilterConfig},
    statistics::StatisticInfo,
};
use env_logger::Env;
use futures::{stream::Skip, Stream, StreamExt};
use indexer_base::{
    chunks::{serialize_chunks, Chunk, ChunkResults, VoidResults},
    config::*,
    error_reporter::*,
    export::export_file_line_based,
    progress::IndexingResults,
};
use indicatif::{ProgressBar, ProgressStyle};
use merging::merger::merge_files_use_config_file;
use parsers::{
    dlt::{DltParser, DltRangeParser},
    ByteRepresentation, LogMessage, MessageStreamItem,
};
use processor::{
    dlt_source::DltSource,
    dlt_utils::{count_dlt_messages, count_dlt_messages_old, get_dlt_file_info},
    grabber::{GrabError, GrabbedContent},
    text_source::TextFileSource,
};
use sources::{
    pcap::file::{convert_from_pcapng, create_index_and_mapping_from_pcapng, PcapngByteSource},
    producer::MessageProducer,
    raw::binary::BinaryByteSource,
};
use std::{
    fs::File,
    io::{BufReader, BufWriter, Write},
    path::Path,
};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use tokio::sync;

lazy_static! {
    static ref EXAMPLE_FIBEX: std::path::PathBuf =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../dlt/test_samples/dlt-messages.xml");
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

fn init_logging() {
    env_logger::Builder::from_env(Env::default().default_filter_or("error")).init();
    info!("logging initialized");
}

#[tokio::main]
pub async fn main() -> Result<()> {
    init_logging();
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
                .about("test exporting files")
                .arg(
                    Arg::with_name("file")
                        .short("f")
                        .long("file")
                        .help("the file to export")
                        .required(true)
                        .index(1),
                )
                .arg(
                    Arg::with_name("legacy")
                        .short("l")
                        .long("legacy")
                        .help("use legacy parsing"),
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
                    Arg::with_name("legacy")
                        .short("l")
                        .long("legacy")
                        .help("use legacy parsing"),
                )
                .arg(
                    Arg::with_name("count")
                        .short("c")
                        .long("count")
                        .help("count dlt messages"),
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
        handle_dlt_pcap_subcommand(matches, start).await
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
        let export: bool = matches.is_present("export");
        match (input_path_string_res, start_res, length_res) {
            (Ok(input_path), Ok(start), Ok(length)) => {
                println!(
                    "read file: {} from {} -> {}",
                    input_path,
                    start,
                    start + length
                );
                // let rt = Runtime::new()?;
                // rt.block_on(async {
                let input_p = path::PathBuf::from(&input_path);

                let is_dlt = input_p
                    .extension()
                    .expect("Could not get extension of file")
                    == "dlt";
                let start_index = if start > 0 { start - 1 } else { start };
                let res: Result<(GrabbedContent, Instant), GrabError> = if is_dlt {
                    type GrabberType = processor::grabber::Grabber<DltSource>;
                    let start_op = Instant::now();
                    let source = DltSource::new(&input_p, "sourceA", true);
                    let grabber = if matches.is_present("metadata") {
                        let metadata_path =
                            matches.value_of("metadata").expect("input must be present");
                        println!("grabber with metadata");
                        GrabberType::lazy(source)
                            .expect("Grabber could not be initialized lazily")
                            .load_metadata(path::PathBuf::from(metadata_path))
                            .expect("")
                    } else {
                        println!("Grabber sync DLT API");
                        GrabberType::new(source).expect("Grabber could not be initialized lazily")
                    };
                    duration_report(
                        start_op,
                        format!(
                            "initializing Grabber for {:?} lines",
                            grabber.log_entry_count()
                        ),
                    );

                    if export {
                        cache_metadata_to_file(&input_p, &grabber);
                    }

                    let r = LineRange::from(start_index..=(start_index + length - 1));
                    let start_op = Instant::now();
                    Ok((grabber.get_entries(&r)?, start_op))
                } else {
                    type GrabberType = processor::grabber::Grabber<TextFileSource>;
                    let source = TextFileSource::new(&input_p, "sourceA");
                    let start_op = Instant::now();
                    let grabber = if matches.is_present("metadata") {
                        let metadata_path =
                            matches.value_of("metadata").expect("input must be present");
                        println!("grabber with metadata");
                        GrabberType::lazy(source)
                            .expect("Grabber could not be initialized lazily")
                            .load_metadata(path::PathBuf::from(metadata_path))
                            .expect("")
                    } else {
                        println!("Grabber sync text API");
                        GrabberType::new(source).expect("Grabber could not be initialized lazily")
                    };
                    duration_report(
                        start_op,
                        format!(
                            "initializing Grabber for {:?} lines",
                            grabber.log_entry_count()
                        ),
                    );

                    if export {
                        cache_metadata_to_file(&input_p, &grabber);
                    }

                    let r = LineRange::from(start_index..=(start_index + length - 1));
                    let start_op = Instant::now();
                    Ok((grabber.get_entries(&r)?, start_op))
                };

                match res {
                    Ok((v, start_op)) => {
                        duration_report(start_op, format!("grabbing {} lines", length));
                        let mut i = start_index;
                        let cap_after = 150;
                        for (cnt, s) in v.grabbed_elements.iter().enumerate() {
                            if s.content.len() > cap_after {
                                println!("[{}]--> {}", i + 1, &s.content[..cap_after]);
                            } else {
                                println!("[{}]--> {}", i + 1, &s.content);
                            }
                            i += 1;
                            if cnt > 15 {
                                println!("...{} more lines", v.grabbed_elements.len() - 15);
                                break;
                            }
                        }
                    }
                    Err(e) => {
                        report_error(format!("Error during line grabbing: {}", e));
                        std::process::exit(2);
                    }
                }
                //});
                Ok(())
            }
            _ => {
                report_error("could not find out size of source file");
                std::process::exit(2);
            }
        }
    }

    fn cache_metadata_to_file<T: processor::grabber::MetadataSource>(
        input_p: &Path,
        grabber: &processor::grabber::Grabber<T>,
    ) {
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
                        serialize_chunks(&chunks, &mapping_out_path).unwrap();
                        let file_size_in_mb = source_file_size as f64 / 1024.0 / 1024.0;
                        if status_updates {
                            duration_report_throughput(
                                start,
                                format!("processing ~{} MB", file_size_in_mb.round()),
                                file_size_in_mb,
                                "MB".to_string(),
                            );
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

            let progress_bar = initialize_progress_bar(100_u64);
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
            let out_path =
                path::PathBuf::from(matches.value_of("target").unwrap_or(fallback_out.as_str()));
            let file_path = path::PathBuf::from(file_name);
            let was_session_file: bool = matches.is_present("is_session_file");
            let old_way: bool = matches.is_present("legacy");
            let sections_string = value_t_or_exit!(matches.value_of("sections"), String);
            let sections: Vec<IndexSection> = sections_string
                .split('|')
                .map(|s| to_pair(s).expect("could not parse section pair"))
                .collect();

            let (tx, _rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
            let ending = &file_path.extension().expect("could not get extension");
            let in_file = File::open(&file_path).unwrap();
            let reader = BufReader::new(&in_file);
            if ending.to_str() == Some("dlt") {
                trace!("was dlt file");
                if old_way {
                    debug!("export dlt file the old way");
                    export_as_dlt_file(file_path, out_path, SectionConfig { sections }, tx)
                        .expect("export did not work");
                } else if !sections.is_empty() {
                    debug!("try new way of exporting");
                    let dlt_parser = DltRangeParser::new(true);
                    let source = BinaryByteSource::new(reader);

                    let mut dlt_msg_producer = MessageProducer::new(dlt_parser, source);
                    let msg_stream = dlt_msg_producer.as_stream();
                    futures::pin_mut!(msg_stream);
                    let out_file = File::create(out_path).expect("could not create file");
                    let mut out_writer = BufWriter::new(out_file);

                    let section_stream = produce_section_stream(msg_stream, sections).await;
                    futures::pin_mut!(section_stream);
                    while let Some((_, item)) = section_stream.next().await {
                        if let MessageStreamItem::Item(msg) = item {
                            msg.to_writer(&mut out_writer).unwrap();
                        }
                    }
                    out_writer.flush().unwrap();
                }
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
            let filter_conf: Option<DltFilterConfig> = match matches.value_of("filter_config") {
                Some(filter_config_file_name) => {
                    let config_path = path::PathBuf::from(filter_config_file_name);
                    let mut cnf_file = match fs::File::open(&config_path) {
                        Ok(file) => file,
                        Err(_) => {
                            report_error(format!("could not open filter config {:?}", config_path));
                            std::process::exit(2)
                        }
                    };
                    read_filter_options(&mut cnf_file)
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
                    Some(load_test_fibex()),
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
                        serialize_chunks(&chunks, &mapping_out_path).unwrap();
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

    async fn progress_listener(
        source_file_size: u64,
        mut rx: mpsc::Receiver<VoidResults>,
        start: std::time::Instant,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            println!("start progress listener for {} bytes", source_file_size);
            while let Some(item) = rx.recv().await {
                match item {
                    Ok(IndexingProgress::Finished { .. }) => {
                        print!("FINISHED!!!!!!!!!!!!!!!!!!!!!");
                        // progress_bar.finish_and_clear();

                        let file_size_in_mb = source_file_size as f64 / 1024.0 / 1024.0;
                        duration_report_throughput(
                            start,
                            format!("processing ~{} MB", file_size_in_mb.round()),
                            file_size_in_mb,
                            "MB".to_string(),
                        );
                        break;
                    }
                    Ok(IndexingProgress::Progress { ticks }) => {
                        let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
                        println!("progress... ({:.0} %)", progress_fraction * 100.0);
                        // progress_bar.set_position((progress_fraction * (total as f64)) as u64);
                    }
                    Ok(IndexingProgress::GotItem { item: chunk }) => {
                        println!("Invalid chunk received {:?}", chunk);
                    }
                    Err(Notification {
                        severity,
                        content,
                        line,
                    }) => {
                        if severity == Severity::WARNING {
                            report_warning_ln(content, line);
                        } else {
                            report_error_ln(content, line);
                        }
                    }
                    _ => report_warning("process finished without result"),
                }
            }
        })
    }

    async fn handle_dlt_pcap_subcommand(matches: &clap::ArgMatches<'_>, start: std::time::Instant) {
        debug!("handle_dlt_pcap_subcommand");
        if let (Some(file_name), Some(tag)) = (matches.value_of("input"), matches.value_of("tag")) {
            let filter_conf: Option<DltFilterConfig> = match matches.value_of("filter_config") {
                Some(filter_config_file_name) => {
                    let config_path = path::PathBuf::from(filter_config_file_name);
                    let mut cnf_file = match fs::File::open(&config_path) {
                        Ok(file) => file,
                        Err(_) => {
                            report_error(format!("could not open filter config {:?}", config_path));
                            std::process::exit(2)
                        }
                    };
                    read_filter_options(&mut cnf_file)
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
            let mapping_out_path = path::PathBuf::from(file_name.to_string() + ".map.json");
            let chunk_size = value_t_or_exit!(matches.value_of("chunk_size"), usize);
            let tag_string = tag.to_string();
            let source_file_size = fs::metadata(&file_path).expect("file size error").len();
            // let progress_bar = initialize_progress_bar(total);
            let in_one_go: bool = matches.is_present("convert");

            let cancel = CancellationToken::new();
            let fibex_config = load_test_fibex();
            let fibex_metadata: Option<FibexMetadata> = gather_fibex_data(fibex_config);
            let dlt_parser = DltParser {
                filter_config: filter_conf.map(process_filter_config),
                fibex_metadata: fibex_metadata.as_ref(),
                with_storage_header: false,
            };
            if in_one_go {
                println!("one-go");
                let (tx, rx): (mpsc::Sender<VoidResults>, mpsc::Receiver<VoidResults>) =
                    mpsc::channel(100);
                let (_, res) = tokio::join! {
                    progress_listener(source_file_size, rx, start),
                    convert_from_pcapng(&file_path, &out_path, tx, cancel, dlt_parser),
                };
                println!("total res was: {:?}", res);
            } else {
                println!("NOT one-go");
                let (tx, mut rx): (mpsc::Sender<ChunkResults>, mpsc::Receiver<ChunkResults>) =
                    mpsc::channel(100);
                let in_file = File::open(&file_path).expect("cannot open file");
                let source = PcapngByteSource::new(in_file).expect("cannot create source");
                let res = create_index_and_mapping_from_pcapng(
                    IndexingConfig {
                        tag: tag_string,
                        chunk_size,
                        in_file: file_path,
                        out_path,
                        append,
                        watch: false,
                    },
                    &tx,
                    cancel,
                    dlt_parser,
                    source,
                )
                .await;

                if let Err(reason) = res {
                    report_error(format!("couldn't process: {}", reason));
                    std::process::exit(2)
                }
                // });
                let mut chunks: Vec<Chunk> = vec![];
                loop {
                    match rx.recv().await {
                        None => {
                            report_error("couldn't receive from channel".to_string());
                            std::process::exit(2)
                        }
                        Some(Ok(IndexingProgress::Finished { .. })) => {
                            serialize_chunks(&chunks, &mapping_out_path).unwrap();
                            // progress_bar.finish_and_clear();
                            break;
                        }
                        Some(Ok(IndexingProgress::Progress { ticks })) => {
                            let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
                            trace!("progress... ({:.0} %)", progress_fraction * 100.0);
                            // progress_bar.set_position((progress_fraction * (total as f64)) as u64);
                        }
                        Some(Ok(IndexingProgress::GotItem { item: chunk })) => {
                            println!("{:?}", chunk);
                            chunks.push(chunk);
                        }
                        Some(Err(Notification {
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
                        Some(_) => report_warning("process finished without result"),
                    }
                }
            }

            println!("done with handle_dlt_pcap_subcommand");
            std::process::exit(0)
        }
    }

    async fn handle_dlt_udp_subcommand(matches: &clap::ArgMatches<'_>) {
        debug!("handle_dlt_udp_subcommand");
        if let (Some(ip_address), Some(tag), Some(output)) = (
            matches.value_of("ip"),
            matches.value_of("tag"),
            matches.value_of("output"),
        ) {
            let filter_conf: Option<DltFilterConfig> = match matches.value_of("filter_config") {
                Some(filter_config_file_name) => {
                    let config_path = path::PathBuf::from(filter_config_file_name);
                    let mut cnf_file = match fs::File::open(&config_path) {
                        Ok(file) => file,
                        Err(_) => {
                            report_error(format!("could not open filter config {:?}", config_path));
                            std::process::exit(2)
                        }
                    };
                    read_filter_options(&mut cnf_file)
                }
                None => None,
            };
            let out_path = path::PathBuf::from(output);
            let mapping_out_path: path::PathBuf =
                path::PathBuf::from(output.to_string() + ".map.json");

            let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
            let shutdown_channel = sync::mpsc::channel(1);
            let tag_string = tag.to_string();
            let socket_conf = SocketConfig {
                udp_connection_info: Some(UdpConnectionInfo {
                    multicast_addr: vec![MulticastInfo {
                        multiaddr: ip_address.to_string(),
                        interface: None,
                    }],
                }),
                bind_addr: "0.0.0.0".to_string(),
                port: "8888".to_string(),
            };

            use chrono::Local;
            let now = Local::now();
            let session_id = format!("dlt_session_id_{}.dlt", now.format("%Y%b%d_%H-%M-%S"));
            tokio::spawn(async move {
                let res = dlt::dlt_net::create_index_and_mapping_dlt_from_socket(
                    session_id,
                    socket_conf,
                    tag_string.as_str(),
                    &out_path,
                    filter_conf,
                    &tx,
                    shutdown_channel.1,
                    Some(load_test_fibex()),
                )
                .await;

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
                        serialize_chunks(&chunks, &mapping_out_path).unwrap();
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
        let count: bool = matches.is_present("count");
        let old_way: bool = matches.is_present("legacy");
        if count {
            if let Ok(res) = if old_way {
                count_dlt_messages_old(&file_path)
            } else {
                count_dlt_messages(&file_path).await
            } {
                println!(
                    "counting dlt-msgs in file ({} way): {}",
                    if old_way { "old" } else { "new" },
                    res
                );
            }
        } else {
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

            let res = get_dlt_file_info(&file_path, None);
            match res {
                Ok(res) => {
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

fn load_test_fibex() -> FibexConfig {
    FibexConfig {
        fibex_file_paths: vec![format!("{}", EXAMPLE_FIBEX.to_string_lossy())],
    }
}

fn initialize_progress_bar(len: u64) -> ProgressBar {
    let progress_bar = ProgressBar::new(len);
    progress_bar.set_style(ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
                .progress_chars("#>-"));
    progress_bar
}

pub async fn produce_section_stream<S, T>(
    input_stream: S,
    sections: Vec<IndexSection>,
) -> impl Stream<Item = T>
where
    S: Stream<Item = T> + Unpin,
{
    let mut stream = input_stream.skip(0);
    let mut index = 0usize;
    stream! {
        // for (start, len, a) in sections {
        for section in sections {
            let to_skip = section.first_line - index;
            debug!("start: {}, len: {}, need to skip: {}", section.first_line, section.len(), to_skip);
            stream = stream.into_inner().skip(to_skip);
            for _ in 0..section.len() {
                if let Some(elem) = stream.next().await {
                    yield elem;
                } else {
                    println!("end of stream reached");
                    break;
                }
            }
            index = section.first_line + section.len();
        }
    }
}
