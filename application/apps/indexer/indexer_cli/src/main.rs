#![deny(unused_crate_dependencies)]
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
extern crate indexer_base;
// extern crate merging;
extern crate processor;

#[macro_use]
extern crate lazy_static;

mod interactive;

use crate::interactive::handle_interactive_session;
use anyhow::{anyhow, Result};
use dlt_core::{
    fibex::FibexConfig,
    filtering::{read_filter_options, DltFilterConfig},
    parse::DltParseError,
    statistics::{collect_dlt_stats, count_dlt_messages as count_dlt_messages_old},
};
use dlt_tools::{extract_dlt_ft, scan_dlt_ft};
use env_logger::Env;
use futures::{pin_mut, stream::StreamExt};
use indexer_base::config::*;
use indicatif::{ProgressBar, ProgressStyle};
use parsers::{
    dlt::{attachment::FileExtractor, DltParser, DltRangeParser},
    someip::SomeipParser,
    text::StringTokenizer,
    LogMessage, MessageStreamItem, ParseYield,
};
use processor::{export::export_raw, grabber::GrabError, text_source::TextFileSource};
use serde::{Deserialize, Serialize};
use sources::{
    binary::{pcap::ng::PcapngByteSource, raw::BinaryByteSource},
    producer::MessageProducer,
};
use std::{
    fs::File,
    io::BufReader,
    path::{Path, PathBuf},
};
use structopt::StructOpt;
use tokio_util::sync::CancellationToken;

lazy_static! {
    static ref EXAMPLE_FIBEX: std::path::PathBuf =
        std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../dlt/test_samples/dlt-messages.xml");
}

#[macro_use]
extern crate log;
use processor::grabber::LineRange;
use std::{fs, io::Read, time::Instant};

fn init_logging() {
    env_logger::Builder::from_env(Env::default().default_filter_or("warn")).init();
    info!("logging initialized");
}
#[derive(Serialize, Deserialize, Debug)]
pub struct FormatTestOptions {
    pub file: String,
    pub lines_to_test: i64,
    pub format: String,
}
pub fn read_format_string_options(f: &mut fs::File) -> Result<FormatTestOptions, String> {
    let mut contents = String::new();
    f.read_to_string(&mut contents)
        .expect("reading from file failed");
    match serde_json::from_str(&contents) {
        Ok(v) => Ok(v),
        Err(e) => Err(format!("could not parse json: {e}")),
    }
}

#[derive(StructOpt)]
#[structopt(about = "Create index file and mapping file for chipmunk", author)]
enum Chip {
    #[structopt(about = "Create index file and mapping file for chipmunk")]
    Grab {
        #[structopt(help("Sets the input file path"), parse(from_os_str))]
        input: PathBuf,
        #[structopt(short, long, help("Export metadata to file"))]
        export: bool,
        #[structopt(short, long, name = "START", help = "start index")]
        start_pos: u64,
        #[structopt(short = "x", long, name = "LENGTH", help = "count of items to grab")]
        length: u64,
        #[structopt(short, long, name = "META", help = "slot metadata")]
        metadata: Option<PathBuf>,
        #[structopt(short)]
        verbose: bool,
    },
    #[structopt(about = "Command for creating an index file")]
    Index {
        #[structopt(help = "Sets the input file to be indexed", parse(from_os_str))]
        input: PathBuf,
        #[structopt(short, long, name = "TAG", help = "tag for each log entry")]
        tag: String,
        #[structopt(
            short,
            long = "out",
            help = "output file, \"<file_to_index>.out\" if not present"
        )]
        #[structopt(
            short,
            long,
            help = "How many lines should be in a chunk (used for access later)",
            default_value = "500"
        )]
        chunk_size: usize,
        #[structopt(
            short,
            long = "out",
            help = "output file, \"<file_to_index>.out\" if not present"
        )]
        output: Option<PathBuf>,
        #[structopt(short, long, help = "put out chunk information on stdout")]
        stdout: bool,
        #[structopt(short, long, help = "append to file if exists")]
        append: bool,
        #[structopt(short = "u", long, help = "tail the file (keep watching for updates)")]
        watch: bool,
        #[structopt(short = "w", help = "add timestamp info if available")]
        timestamp: bool,
    },

    #[structopt(about = "Command to test format string")]
    Format {
        #[structopt(
            short = "f",
            long = "format",
            name = "FORMAT_STR",
            help = "format string to use"
        )]
        #[allow(dead_code)]
        format_string: Option<String>,
        #[structopt(
            short = "t",
            long = "test",
            name = "SAMPLE",
            help = "test string to use"
        )]
        #[allow(dead_code)]
        test_string: Option<String>,
        #[structopt(
            short = "c",
            long = "config",
            name = "CONFIG",
            help = "test a file using this configuration"
        )]
        #[allow(dead_code)]
        test_config: Option<PathBuf>,
        #[structopt(short, long, help = "display duration info")]
        #[allow(dead_code)]
        stdout: bool,
    },
    #[structopt(about = "handling dlt input")]
    Dlt {
        #[structopt(help = "the DLT file to parse")]
        input: PathBuf,
        #[structopt(
            short = "m",
            long = "fibex-model",
            name = "FIBEX",
            help = "Fibex file to use"
        )]
        fibex: Option<String>,
        #[structopt(short, long, name = "TAG", help = "tag for each log entry")]
        tag: String,
        #[structopt(short, long, help = "append to file if exists")]
        append: bool,
        #[structopt(
            long = "out",
            name = "OUT",
            help = "Output file, \"<file_to_index>.out\" if not present"
        )]
        output: Option<PathBuf>,
        #[structopt(
            long = "filter",
            name = "FILTER_CONFIG",
            help = "json file that defines dlt filter settings"
        )]
        filter_config: Option<PathBuf>,
        #[structopt(short = "n", long, help = "do not use storage header")]
        no_storage_header: bool,
    },
    #[structopt(about = "extract files from dlt trace")]
    DltFt {
        #[structopt(help = "the DLT file to parse")]
        input: PathBuf,
        #[structopt(
            long = "out",
            name = "OUT",
            help = "Output directory, \"input directory\" if not present"
        )]
        output: Option<PathBuf>,
        #[structopt(
            long = "filter",
            name = "FILTER_CONFIG",
            help = "json file that defines dlt filter settings"
        )]
        filter_config: Option<PathBuf>,
        #[structopt(short, long, help = "run in interactive mode")]
        interactive: bool,
        #[structopt(short, long, help = "parse input without storage headers")]
        raw: bool,
    },
    #[structopt(about = "dlt from pcap files")]
    DltPcap {
        #[structopt(help = "the pcap file to parse")]
        input: PathBuf,
        #[structopt(short, long, name = "TAG", help = "tag for each log entry")]
        tag: String,
        #[structopt(
            short,
            long,
            help = "How many lines should be in a chunk (used for access later)",
            default_value = "500"
        )]
        chunk_size: usize,
        #[structopt(long = "out", name = "OUT", help = "Output file")]
        output: Option<PathBuf>,
        #[structopt(
            long = "filter",
            name = "FILTER_CONFIG",
            help = "json file that defines dlt filter settings"
        )]
        filter_config: Option<PathBuf>,
        #[structopt(short = "n", long, help = "convert file to dlt format")]
        convert: bool,
        #[structopt(short, long, help = "append to file if exists")]
        append: bool,
    },
    #[structopt(about = "someip from pcap files")]
    #[allow(dead_code)]
    SomeIpPcap {
        #[structopt(help = "the pcap file to parse")]
        input: PathBuf,
        #[structopt(long = "out", name = "OUT", help = "Output file")]
        output: Option<PathBuf>,
        #[structopt(short, long, name = "FILE", help = "the model file (FIBEX))")]
        model: Option<PathBuf>,
    },
    #[structopt(about = "dlt statistics")]
    DltStats {
        #[structopt(help = "the DLT file to parse")]
        input: PathBuf,
        #[structopt(short, long, help = "use legacy parsing")]
        legacy: bool,
        #[structopt(short, long, help = "count dlt messages")]
        count: bool,
        #[structopt(short, long, help = "put out chunk information on stdout")]
        stdout: bool,
    },
    #[structopt(about = "detect file type")]
    Detect {
        #[structopt(help = "the file to detect")]
        input: PathBuf,
    },
    #[structopt(about = "test date discovery, either from a string or from a file")]
    Discover {
        #[structopt(
            short,
            long = "input",
            help = "string to extract date from",
            name = "INPUT"
        )]
        #[allow(dead_code)]
        input_string: Option<String>,
        #[structopt(
            short,
            long = "config",
            name = "CONFIG",
            help = "file that contains a list of files to analyze"
        )]
        #[allow(dead_code)]
        config_file: Option<String>,
        #[structopt(
            short = "f",
            long = "file",
            help = "file where the timeformat should be detected"
        )]
        #[allow(dead_code)]
        input_file: Option<PathBuf>,
    },
    #[structopt(about = "test date discovery, either from a string or from a file")]
    Export {
        #[structopt(short, long, help = "the file to export")]
        file: PathBuf,
        #[structopt(short, long, help = "use legacy parsing")]
        legacy: bool,
        #[structopt(
            short,
            long,
            name = "SECTIONS",
            help = "what sections to export, e.g. \"0,3|6,100\""
        )]
        sections: String,
        #[structopt(
            short = "x",
            long = "sessionfile",
            help = "eliminiate session file quirks"
        )]
        is_session_file: bool,
        #[structopt(
            short,
            long = "out",
            name = "OUT",
            help = "Output file, \"<file_to_export>.out\" if not present"
        )]
        target: Option<PathBuf>,
    },
    #[structopt(about = "handling dlt udp input")]
    DltUdp {
        #[structopt(help = "the ip address + port")]
        ip: String,
        #[structopt(short, long, name = "TAG", help = "tag for each log entry")]
        tag: String,
        #[structopt(short, long = "out", name = "OUT", help = "Output file")]
        output: PathBuf,
        #[structopt(
            short,
            long = "filter",
            name = "FILTER_CONFIG",
            help = "json file that defines dlt filter settings"
        )]
        filter_config: Option<PathBuf>,
    },
    #[structopt(about = "command for merging/concatenating multiple log files")]
    Merge {
        #[structopt(
            short,
            long = "merge",
            name = "MERGE_CONFIG",
            help = "json file that defines all files to be merged"
        )]
        merge_config: PathBuf,
        #[structopt(long = "out", name = "OUT", help = "Output file")]
        output: PathBuf,
        #[structopt(
            short,
            long,
            default_value = "500",
            help = "How many lines should be in a chunk (used for access later)"
        )]
        chunk_size: usize,
        #[structopt(short, long, help = "append to file if exists")]
        append: bool,
    },
    #[structopt(about = "enter interactive session")]
    Session {
        #[structopt(help = "Sets the input file path")]
        input: Option<PathBuf>,
    },
}

#[tokio::main]
pub async fn main() -> Result<()> {
    init_logging();
    let start = Instant::now();
    let opt = Chip::from_args();
    match opt {
        Chip::Format {
            format_string: _,
            test_string: _,
            test_config: _,
            stdout: _,
        } => println!("handle_format_subcommand not currently implemented"),
        Chip::Grab {
            input,
            start_pos,
            length,
            export,
            metadata,
            verbose,
        } => handle_grab_subcommand(&input, start_pos, metadata, length, export, verbose)
            .await
            .expect("could not handle grab command"),
        Chip::Index {
            input,
            tag,
            chunk_size,
            output,
            stdout,
            append,
            watch,
            timestamp,
        } => {
            handle_index_subcommand(
                &input, output, &tag, chunk_size, start, stdout, append, watch, timestamp,
            )
            .await
        }
        Chip::Dlt {
            input,
            fibex,
            tag,
            append,
            output,
            filter_config,
            no_storage_header,
        } => {
            handle_dlt_subcommand(
                &input,
                output,
                tag,
                filter_config,
                fibex,
                append,
                start,
                no_storage_header,
            )
            .await
        }
        Chip::DltFt {
            input,
            output,
            filter_config,
            interactive,
            raw,
        } => handle_dlt_ft_subcommand(input, output, filter_config, interactive, raw, start).await,
        Chip::DltPcap {
            input,
            tag,
            chunk_size,
            output,
            filter_config,
            convert,
            append,
        } => {
            handle_dlt_pcap_subcommand(
                &input,
                output,
                &tag,
                filter_config,
                convert,
                append,
                chunk_size,
                start,
            )
            .await
        }
        Chip::SomeIpPcap {
            input: _,
            output: _,
            model: _,
        } => println!("NYI someip from pcap not available on cli"),
        Chip::DltStats {
            input,
            legacy,
            count,
            stdout,
        } => handle_dlt_stats_subcommand(&input, count, legacy, start, stdout).await,
        Chip::Detect { input } => handle_detect_file_type_subcommand(&input).await,
        Chip::Discover {
            input_string: _,
            config_file: _,
            input_file: _,
        } => println!("handle_discover_subcommand currently not implemented"),
        Chip::Export {
            file,
            legacy,
            sections,
            is_session_file,
            target,
        } => {
            handle_export_subcommand(&file, target, is_session_file, sections, legacy, start).await
        }
        Chip::DltUdp {
            ip,
            tag,
            output,
            filter_config,
        } => handle_dlt_udp_subcommand(&ip, &tag, &output, filter_config).await,
        Chip::Merge {
            merge_config,
            output,
            chunk_size,
            append,
        } => handle_merge_subcommand(merge_config, append, output, chunk_size).await,
        Chip::Session { input } => handle_interactive_session(input).await,
    }

    async fn handle_grab_subcommand(
        input_path: &Path, // = matches.value_of_t("input").unwrap_or_else(|e| e.exit());
        start: u64,
        metadata: Option<PathBuf>,
        length: u64,  // = matches.value_of_t("length").unwrap_or_else(|e| e.exit());
        export: bool, // = matches.is_present("export");
        _status_updates: bool,
    ) -> Result<()> {
        println!(
            "read file: {:?} from {} -> {}",
            input_path,
            start,
            start + length
        );
        let input_p = PathBuf::from(&input_path);

        let is_dlt = input_p
            .extension()
            .expect("Could not get extension of file")
            == "dlt";
        let start_index = if start > 0 { start - 1 } else { start };
        if is_dlt {
            println!("dlt grabbing not supported anymore");
            std::process::exit(0);
        }
        let res: Result<(Vec<String>, Instant), GrabError> = {
            type GrabberType = processor::grabber::Grabber;
            let source = TextFileSource::new(&input_p);
            let start_op = Instant::now();
            let grabber = match metadata {
                Some(metadata_path) => {
                    println!("grabber with metadata");
                    GrabberType::lazy(source)
                        .expect("Grabber could not be initialized lazily")
                        .load_metadata(metadata_path)
                        .expect("")
                }
                None => {
                    println!("Grabber sync text API");
                    GrabberType::new(source).expect("Grabber could not be initialized lazily")
                }
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
                duration_report(start_op, format!("grabbing {length} lines"));
                let mut i = start_index;
                let cap_after = 150;
                for (cnt, s) in v.iter().enumerate() {
                    if s.len() > cap_after {
                        println!("[{}]--> {}", i + 1, &s[..cap_after]);
                    } else {
                        println!("[{}]--> {}", i + 1, &s);
                    }
                    i += 1;
                    if cnt > 15 {
                        println!("...{} more lines", v.len() - 15);
                        break;
                    }
                }
            }
            Err(e) => {
                println!("Error during line grabbing: {e}");
                std::process::exit(2);
            }
        }
        Ok(())
    }

    fn cache_metadata_to_file(input_p: &Path, grabber: &processor::grabber::Grabber) {
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

    #[allow(clippy::too_many_arguments)]
    async fn handle_index_subcommand(
        _file_path: &Path,
        _output_path: Option<PathBuf>,
        _tag: &str,
        _chunk_size: usize,
        _start: std::time::Instant,
        _status_updates: bool,
        _append: bool,
        _watch: bool,
        _timestamps: bool,
    ) {
        unimplemented!("needs implmementation using stream architecture");
        // let total = fs::metadata(file_path).expect("file size error").len();
        // let progress_bar = initialize_progress_bar(total);
        // let tag_string = tag.to_string();
        // let fallback_out = format!("{}.out", file_path.to_string_lossy());
        // let out_path = output_path.unwrap_or_else(|| PathBuf::from(fallback_out.as_str()));
        // let mapping_out_path: PathBuf =
        //     PathBuf::from(format!("{}.map.json", file_path.to_string_lossy()));

        // let source_file_size = match fs::metadata(file_path) {
        //     Ok(file_meta) => file_meta.len(),
        //     Err(_) => {
        //         report_error("could not find out size of source file");
        //         std::process::exit(2);
        //     }
        // };
        // let (tx, rx): (
        //     cc::Sender<IndexingResults<Chunk>>,
        //     cc::Receiver<ChunkResults>,
        // ) = unbounded();

        // let in_file = PathBuf::from(file_path);
        // let _h = tokio::spawn(async move {
        //     if let Err(why) = processor::processor::create_index_and_mapping(
        //         IndexingConfig {
        //             tag: tag_string,
        //             chunk_size,
        //             in_file,
        //             out_path,
        //             append,
        //             watch,
        //         },
        //         source_file_size,
        //         timestamps,
        //         tx,
        //         None,
        //     )
        //     .await
        //     {
        //         report_error(format!("couldn't process: {why}"));
        //         std::process::exit(2)
        //     }
        // });
        // loop {
        //     let mut chunks: Vec<Chunk> = vec![];
        //     match rx.recv() {
        //         Ok(Ok(IndexingProgress::Finished)) => {
        //             trace!("finished...");
        //             serialize_chunks(&chunks, &mapping_out_path).unwrap();
        //             let file_size_in_mb = source_file_size as f64 / 1024.0 / 1024.0;
        //             if status_updates {
        //                 duration_report_throughput(
        //                     start,
        //                     format!("processing ~{} MB", file_size_in_mb.round()),
        //                     file_size_in_mb,
        //                     "MB".to_string(),
        //                 );
        //             }
        //             progress_bar.finish_and_clear();
        //             break;
        //         }
        //         Ok(Ok(IndexingProgress::Progress { ticks })) => {
        //             let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
        //             trace!("progress... ({:.0} %)", progress_fraction * 100.0);
        //             progress_bar.set_position((progress_fraction * (total as f64)) as u64);
        //         }
        //         Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
        //             chunks.push(chunk);
        //         }
        //         Ok(Err(Notification {
        //             severity,
        //             content,
        //             line,
        //         })) => {
        //             if severity == Severity::WARNING {
        //                 report_warning_ln(content, line);
        //             } else {
        //                 report_error_ln(content, line);
        //             }
        //         }
        //         Ok(Ok(IndexingProgress::Stopped)) => {
        //             trace!("stopped...");
        //             report_warning("IndexingProgress::Stopped");
        //         }
        //         Err(_) => {
        //             report_error("couldn't process");
        //             std::process::exit(2)
        //         }
        //     }
        // }
    }

    async fn handle_merge_subcommand(
        _merge_conf_path: PathBuf,
        _append: bool,
        _out_path: PathBuf,
        _chunk_size: usize,
    ) {
        unimplemented!("needs implmementation using stream architecture");
        // debug!("handle_merge_subcommand");
        // // let concat_conf_path_string_res: clap::Result<String> = matches.value_of_t("concat_config");
        // let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();

        // let progress_bar = initialize_progress_bar(100_u64);
        // thread::spawn(move || {
        //     if let Err(why) = merge_files_use_config_file(
        //         &merge_conf_path,
        //         &out_path,
        //         append,
        //         chunk_size,
        //         tx,
        //         None,
        //     ) {
        //         report_error(format!("couldn't process: {why}"));
        //         std::process::exit(2)
        //     }
        // });
        // let mut chunks: Vec<Chunk> = vec![];
        // loop {
        //     match rx.recv() {
        //         Err(why) => {
        //             report_error(format!("couldn't process: {why}"));
        //             std::process::exit(2)
        //         }
        //         Ok(Ok(IndexingProgress::Finished { .. })) => {
        //             println!("received finish event");
        //             progress_bar.finish_and_clear();
        //             break;
        //         }
        //         Ok(Ok(IndexingProgress::Progress { ticks })) => {
        //             let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
        //             let pos = (progress_fraction * 100f64) as u64;
        //             progress_bar.set_position(pos);
        //         }
        //         Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
        //             chunks.push(chunk);
        //         }
        //         Ok(Err(Notification {
        //             severity,
        //             content,
        //             line,
        //         })) => {
        //             if severity == Severity::WARNING {
        //                 report_warning_ln(content, line);
        //             } else {
        //                 report_error_ln(content, line);
        //             }
        //         }
        //         Ok(_) => report_warning("process finished without result"),
        //     }
        // }

        // println!("done with handle_merge_subcommand");
        // std::process::exit(0)
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
    async fn handle_export_subcommand(
        file_path: &Path,
        out_path: Option<PathBuf>,
        _was_session_file: bool,
        sections_string: String,
        _old_way: bool,
        _start: std::time::Instant,
    ) {
        debug!("handle_export_subcommand");

        let fallback_out = format!("{}.out", file_path.to_string_lossy());
        let out_path = out_path.unwrap_or_else(|| PathBuf::from(fallback_out.as_str()));
        // let was_session_file: bool = matches.is_present("is_session_file");
        // let old_way: bool = matches.is_present("legacy");
        // let sections_string: String = matches.value_of_t_or_exit("sections");
        let sections: Vec<IndexSection> = if sections_string.is_empty() {
            vec![]
        } else {
            sections_string
                .split('|')
                .map(|s| to_pair(s).expect("could not parse section pair"))
                .collect()
        };

        let ending = &file_path.extension().expect("could not get extension");
        let in_file = File::open(file_path).unwrap();
        let _reader = BufReader::new(&in_file);
        if ending.to_str() == Some("dlt") {
            let dlt_parser = DltParser::new(None, None, None, true);
            let reader = BufReader::new(&in_file);
            let source = BinaryByteSource::new(reader);
            let mut dlt_msg_producer = MessageProducer::new(dlt_parser, source, None);
            let cancel = CancellationToken::new();
            export_raw(
                Box::pin(dlt_msg_producer.as_stream()),
                &out_path,
                &sections,
                false,
                false,
                &cancel,
            )
            .await
            .expect("export_raw failed");
        } else {
            trace!("was regular file");
            unimplemented!("needs implmementation using stream architecture");
            // if old_way {
            //     let (tx, _rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
            //     println!("was regular file (legacy way)");
            //     export_file_line_based(
            //         file_path,
            //         out_path,
            //         SectionConfig { sections },
            //         was_session_file,
            //         tx,
            //     )
            //     .expect("export did not work");
            // } else {
            //     println!("regular file, new way");
            //     todo!("use grabber for export");
            // }
        };

        println!("done with handle_export_subcommand");
        std::process::exit(0)
    }

    #[allow(clippy::too_many_arguments)]
    async fn handle_dlt_subcommand(
        _file_path: &Path,
        _out_path: Option<PathBuf>,
        _tag_string: String,
        _filter_config: Option<PathBuf>,
        _fibex: Option<String>,
        _append: bool,
        _start: std::time::Instant,
        _no_storage_header: bool,
    ) {
        unimplemented!();
    }

    async fn handle_dlt_ft_subcommand(
        file_path: PathBuf,
        out_path: Option<PathBuf>,
        filter_config: Option<PathBuf>,
        interactive: bool,
        raw: bool,
        start: std::time::Instant,
    ) {
        debug!("handle_dlt_ft_subcommand");

        let filter_conf: Option<DltFilterConfig> = match filter_config {
            Some(config_path) => {
                let mut cnf_file = match fs::File::open(&config_path) {
                    Ok(file) => file,
                    Err(_) => {
                        println!("could not open filter config {config_path:?}");
                        std::process::exit(2)
                    }
                };
                read_filter_options(&mut cnf_file)
            }
            None => None,
        };

        let with_storage_header = !raw;
        let output_dir = match out_path {
            Some(path) => path,
            None => file_path.parent().unwrap().to_path_buf(),
        };

        if interactive {
            // extract selected files
            println!("scan files..");
            let files = scan_dlt_ft(
                file_path.clone(),
                filter_conf.clone(),
                with_storage_header,
                CancellationToken::new(),
            )
            .await
            .unwrap();

            if files.is_empty() {
                println!("no file(s) found!");
                std::process::exit(0);
            }
            for (pos, file) in files.iter().enumerate() {
                let index: usize = pos + 1;
                println!("<{}>\t{} ({} bytes)", index, file.name, file.size);
            }
            loop {
                println!("enter file indexes [<num>,...] or 'q' for exit:");
                let mut input = String::new();
                std::io::stdin().read_line(&mut input).unwrap();
                if input.trim() == "q" {
                    std::process::exit(0)
                }

                let mut selected_files = Vec::new();
                for part in input.trim().split(',') {
                    if let Ok(index) = part.parse::<usize>() {
                        if let Some(file) = files.get(index - 1) {
                            selected_files.push(file.clone());
                        }
                    }
                }

                let size = extract_dlt_ft(
                    Path::new(&output_dir),
                    FileExtractor::files_with_names(selected_files),
                    CancellationToken::new(),
                )
                .unwrap();

                println!("{size} bytes written");
            }
        } else {
            // extract all files
            println!("scan files..");
            let files = scan_dlt_ft(
                file_path.clone(),
                filter_conf.clone(),
                with_storage_header,
                CancellationToken::new(),
            )
            .await
            .unwrap();

            println!("extract files..");
            let size = extract_dlt_ft(
                Path::new(&output_dir),
                FileExtractor::files_with_names_prefixed(files),
                CancellationToken::new(),
            )
            .unwrap();

            println!("{size} bytes written");

            let source_file_size = fs::metadata(file_path).expect("file size error").len();
            let file_size_in_mb = source_file_size as f64 / 1024.0 / 1024.0;
            let out_file_size_in_mb = size as f64 / 1024.0 / 1024.0;

            duration_report_throughput(
                start,
                format!(
                    "processing ~{} MB (wrote ~{} MB contained data)",
                    file_size_in_mb.round(),
                    out_file_size_in_mb.round(),
                ),
                file_size_in_mb,
                "MB".to_string(),
            );
        }

        println!("done with handle_dlt_ft_subcommand");
        std::process::exit(0)
    }

    // #[allow(dead_code)]
    // async fn progress_listener(
    //     source_file_size: u64,
    //     mut rx: mpsc::Receiver<VoidResults>,
    //     start: std::time::Instant,
    // ) -> tokio::task::JoinHandle<()> {
    //     tokio::spawn(async move {
    //         println!("start progress listener for {source_file_size} bytes");
    //         while let Some(item) = rx.recv().await {
    //             match item {
    //                 Ok(IndexingProgress::Finished { .. }) => {
    //                     print!("FINISHED!!!!!!!!!!!!!!!!!!!!!");
    //                     // progress_bar.finish_and_clear();

    //                     let file_size_in_mb = source_file_size as f64 / 1024.0 / 1024.0;
    //                     duration_report_throughput(
    //                         start,
    //                         format!("processing ~{} MB", file_size_in_mb.round()),
    //                         file_size_in_mb,
    //                         "MB".to_string(),
    //                     );
    //                     break;
    //                 }
    //                 Ok(IndexingProgress::Progress { ticks }) => {
    //                     let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
    //                     println!("progress... ({:.0} %)", progress_fraction * 100.0);
    //                     // progress_bar.set_position((progress_fraction * (total as f64)) as u64);
    //                 }
    //                 Ok(IndexingProgress::GotItem { item: chunk }) => {
    //                     println!("Invalid chunk received {chunk:?}");
    //                 }
    //                 Err(Notification {
    //                     severity,
    //                     content,
    //                     line,
    //                 }) => {
    //                     if severity == Severity::WARNING {
    //                         report_warning_ln(content, line);
    //                     } else {
    //                         report_error_ln(content, line);
    //                     }
    //                 }
    //                 _ => report_warning("process finished without result"),
    //             }
    //         }
    //     })
    // }

    #[allow(clippy::too_many_arguments)]
    async fn handle_dlt_pcap_subcommand(
        _file_path: &Path,
        _output: Option<PathBuf>,
        _tag: &str,
        _filter_config_path: Option<PathBuf>,
        _in_one_go: bool,
        _append: bool,
        _chunk_size: usize,
        _start: std::time::Instant,
    ) {
        unimplemented!("needs implmementation using stream architecture");
        // debug!("handle_dlt_pcap_subcommand");

        // let filter_conf: Option<DltFilterConfig> = match filter_config_path {
        //     Some(config_path) => {
        //         let mut cnf_file = match fs::File::open(&config_path) {
        //             Ok(file) => file,
        //             Err(_) => {
        //                 report_error(format!("could not open filter config {config_path:?}"));
        //                 std::process::exit(2)
        //             }
        //         };
        //         read_filter_options(&mut cnf_file)
        //     }
        //     None => None,
        // };
        // let fallback_out = format!("{}.out", file_path.to_string_lossy());
        // let out_path = output.unwrap_or_else(|| PathBuf::from(fallback_out.as_str()));
        // let mapping_out_path = PathBuf::from(format!("{}.map.json", file_path.to_string_lossy()));
        // let tag_string = tag.to_string();
        // let source_file_size = fs::metadata(file_path).expect("file size error").len();
        // // let progress_bar = initialize_progress_bar(total);

        // let cancel = CancellationToken::new();
        // let fibex_config = load_test_fibex();
        // let fibex_metadata: Option<FibexMetadata> = gather_fibex_data(fibex_config);
        // let dlt_parser = DltParser {
        //     filter_config: filter_conf.map(|f| f.into()),
        //     fibex_metadata: fibex_metadata.as_ref(),
        //     with_storage_header: false,
        // };
        // if in_one_go {
        //     println!("one-go");
        //     let (tx, rx): (mpsc::Sender<VoidResults>, mpsc::Receiver<VoidResults>) =
        //         mpsc::channel(100);
        //     let (_, res) = tokio::join! {
        //         progress_listener(source_file_size, rx, start),
        //         convert_from_pcapng(file_path, &out_path, tx, cancel, dlt_parser),
        //     };
        //     println!("total res was: {res:?}");
        // } else {
        //     println!("NOT one-go");
        //     let (tx, mut rx): (mpsc::Sender<ChunkResults>, mpsc::Receiver<ChunkResults>) =
        //         mpsc::channel(100);
        //     let in_file = File::open(file_path).expect("cannot open file");
        //     let source = PcapngByteSource::new(in_file).expect("cannot create source");
        //     let res = create_index_and_mapping_from_pcapng(
        //         IndexingConfig {
        //             tag: tag_string,
        //             chunk_size,
        //             in_file: PathBuf::from(file_path),
        //             out_path,
        //             append,
        //             watch: false,
        //         },
        //         &tx,
        //         cancel,
        //         dlt_parser,
        //         source,
        //     )
        //     .await;

        //     if let Err(reason) = res {
        //         report_error(format!("couldn't process: {reason}"));
        //         std::process::exit(2)
        //     }
        //     // });
        //     let mut chunks: Vec<Chunk> = vec![];
        //     loop {
        //         match rx.recv().await {
        //             None => {
        //                 report_error("couldn't receive from channel".to_string());
        //                 std::process::exit(2)
        //             }
        //             Some(Ok(IndexingProgress::Finished { .. })) => {
        //                 serialize_chunks(&chunks, &mapping_out_path).unwrap();
        //                 // progress_bar.finish_and_clear();
        //                 break;
        //             }
        //             Some(Ok(IndexingProgress::Progress { ticks })) => {
        //                 let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
        //                 trace!("progress... ({:.0} %)", progress_fraction * 100.0);
        //                 // progress_bar.set_position((progress_fraction * (total as f64)) as u64);
        //             }
        //             Some(Ok(IndexingProgress::GotItem { item: chunk })) => {
        //                 println!("{chunk:?}");
        //                 chunks.push(chunk);
        //             }
        //             Some(Err(Notification {
        //                 severity,
        //                 content,
        //                 line,
        //             })) => {
        //                 if severity == Severity::WARNING {
        //                     report_warning_ln(content, line);
        //                 } else {
        //                     report_error_ln(content, line);
        //                 }
        //             }
        //             Some(_) => report_warning("process finished without result"),
        //         }
        //     }

        //     println!("done with handle_dlt_pcap_subcommand");
        //     std::process::exit(0)
        // }
    }

    async fn handle_dlt_udp_subcommand(
        _ip_address: &str,
        _tag: &str,
        _output_path: &Path,
        _config_path: Option<PathBuf>,
    ) {
        unimplemented!("needs implmementation using stream architecture");
        // debug!("handle_dlt_udp_subcommand");

        // let filter_conf: Option<DltFilterConfig> = match config_path {
        //     Some(config_path) => {
        //         let mut cnf_file = match fs::File::open(&config_path) {
        //             Ok(file) => file,
        //             Err(_) => {
        //                 report_error(format!("could not open filter config {config_path:?}"));
        //                 std::process::exit(2)
        //             }
        //         };
        //         read_filter_options(&mut cnf_file)
        //     }
        //     None => None,
        // };
        // let mapping_out_path: PathBuf =
        //     PathBuf::from(format!("{}.map.json", output_path.to_string_lossy()));

        // let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = unbounded();
        // let shutdown_channel = sync::mpsc::channel(1);
        // let tag_string = tag.to_string();
        // let socket_conf = SocketConfig {
        //     udp_connection_info: Some(UdpConnectionInfo {
        //         multicast_addr: vec![MulticastInfo {
        //             multiaddr: ip_address.to_string(),
        //             interface: None,
        //         }],
        //     }),
        //     bind_addr: "0.0.0.0".to_string(),
        //     port: "8888".to_string(),
        // };

        // use chrono::Local;
        // let now = Local::now();
        // let session_id = format!("dlt_session_id_{}.dlt", now.format("%Y%b%d_%H-%M-%S"));
        // let out_path = PathBuf::from(output_path);
        // tokio::spawn(async move {
        //     let res = create_index_and_mapping_dlt_from_socket(
        //         session_id,
        //         socket_conf,
        //         tag_string.as_str(),
        //         &out_path,
        //         filter_conf,
        //         &tx,
        //         shutdown_channel.1,
        //         Some(load_test_fibex()),
        //     )
        //     .await;

        //     if let Err(reason) = res {
        //         report_error(format!("couldn't process: {reason}"));
        //         std::process::exit(2)
        //     }
        // });
        // let mut chunks: Vec<Chunk> = vec![];
        // loop {
        //     match rx.recv() {
        //         Err(why) => {
        //             report_error(format!("couldn't process: {why}"));
        //             std::process::exit(2)
        //         }
        //         Ok(Ok(IndexingProgress::Finished { .. })) => {
        //             serialize_chunks(&chunks, &mapping_out_path).unwrap();
        //             break;
        //         }
        //         Ok(Ok(IndexingProgress::Progress { ticks })) => {
        //             let progress_fraction = ticks.0 as f64 / ticks.1 as f64;
        //             trace!("progress... ({:.0} %)", progress_fraction * 100.0);
        //         }
        //         Ok(Ok(IndexingProgress::GotItem { item: chunk })) => {
        //             println!("{chunk:?}");
        //             chunks.push(chunk);
        //         }
        //         Ok(Err(Notification {
        //             severity,
        //             content,
        //             line,
        //         })) => {
        //             if severity == Severity::WARNING {
        //                 report_warning_ln(content, line);
        //             } else {
        //                 report_error_ln(content, line);
        //             }
        //         }
        //         Ok(_) => report_warning("process finished without result"),
        //     }
        // }

        // println!("done with handle_dlt_udp_subcommand");
        // std::process::exit(0)
    }

    async fn handle_detect_file_type_subcommand(file_path: &Path) {
        let res = detect_messages_type(file_path).await;

        let start_op = Instant::now();
        duration_report(start_op, "detection of file type".to_string());
        println!("res = {res:?}");
    }

    async fn handle_dlt_stats_subcommand(
        file_path: &Path,
        count: bool,
        old_way: bool,
        start: std::time::Instant,
        status_updates: bool,
    ) {
        if count {
            if let Ok(res) = if old_way {
                count_dlt_messages_old(file_path)
            } else {
                count_dlt_messages(file_path).await
            } {
                println!(
                    "counting dlt-msgs in file ({} way): {}",
                    if old_way { "old" } else { "new" },
                    res
                );
            }
        } else {
            let f = match fs::File::open(file_path) {
                Ok(file) => file,
                Err(_) => {
                    println!("could not open {file_path:?}");
                    std::process::exit(2)
                }
            };
            let source_file_size = match f.metadata() {
                Ok(file_meta) => file_meta.len() as usize,
                Err(_) => {
                    println!("could not find out size of source file");
                    std::process::exit(2);
                }
            };

            let res = collect_dlt_stats(file_path);
            match res {
                Ok(res) => {
                    trace!("got item...");

                    match serde_json::to_string(&res) {
                        Ok(stats) => println!("{stats}"),
                        Err(e) => {
                            println!("serializing result {res:?} failed: {e}");
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
                    println!("couldn't process");
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
            eprintln!("{report} took {duration_in_s:.3}s!");
        } else {
            eprintln!("{report} took {ms:.3}ms!");
        }
    } else {
        eprintln!("{report} took {us:.3}us!");
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
    eprintln!("{report} took {duration_in_s:.3}s! ({amount_per_second:.3} {unit}/s)");
}

fn _load_test_fibex() -> FibexConfig {
    FibexConfig {
        fibex_file_paths: vec![format!("{}", EXAMPLE_FIBEX.to_string_lossy())],
    }
}

fn _initialize_progress_bar(len: u64) -> ProgressBar {
    let progress_bar = ProgressBar::new(len);
    progress_bar.set_style(ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")
                .expect("Could not create template")
                .progress_chars("#>-"));
    progress_bar
}

/// count how many recognizable DLT messages are stored in a file
/// each message needs to be equiped with a storage header
async fn count_dlt_messages(input: &Path) -> Result<u64, DltParseError> {
    if input.exists() {
        let second_reader = BufReader::new(fs::File::open(input)?);
        let dlt_parser = DltRangeParser::new();

        let source = BinaryByteSource::new(second_reader);

        let mut dlt_msg_producer = MessageProducer::new(dlt_parser, source, None);
        let msg_stream = dlt_msg_producer.as_stream();
        Ok(msg_stream.count().await as u64)
    } else {
        Err(DltParseError::Unrecoverable(format!(
            "Couldn't find dlt file: {input:?}"
        )))
    }
}

async fn detect_messages_type(input: &Path) -> Result<bool, DltParseError> {
    if input.exists() {
        {
            println!("try dlt parser");
            let buf_reader = BufReader::new(fs::File::open(input)?);
            let source = BinaryByteSource::new(buf_reader);
            let dlt_parser = DltRangeParser::new();
            let mut dlt_msg_producer = MessageProducer::new(dlt_parser, source, None);
            let msg_stream = dlt_msg_producer.as_stream();
            pin_mut!(msg_stream);
            let mut item_count = 0usize;
            let mut attachment_count = 0usize;
            let mut err_count = 0usize;
            let mut consumed = 0usize;
            'outer: loop {
                let items = match msg_stream.next().await {
                    Some(items) => items,
                    None => break,
                };
                for item in items {
                    match item {
                        (_, MessageStreamItem::Item(ParseYield::Message(item))) => {
                            item_count += 1;
                            consumed += item.range.len();
                        }
                        (
                            _,
                            MessageStreamItem::Item(ParseYield::MessageAndAttachment((
                                item,
                                _attachment,
                            ))),
                        ) => {
                            item_count += 1;
                            attachment_count += 1;
                            consumed += item.range.len();
                        }
                        (_, MessageStreamItem::Item(ParseYield::Attachment(_attachment))) => {
                            attachment_count += 1;
                        }
                        (_, MessageStreamItem::Skipped) => item_count += 1,
                        (_, MessageStreamItem::Incomplete) => err_count += 1,
                        (_, MessageStreamItem::Empty) => err_count += 1,
                        (_, MessageStreamItem::Done) => break 'outer,
                    }
                }
                if item_count > 10 || err_count > 10 {
                    println!(
                        "DLT parser, item_count: {item_count}, err_count: {err_count}, consumed: {consumed}, attachments: {attachment_count}"
                    );
                    break 'outer;
                }
            }
        }
        {
            println!("try pcap someip parser");
            let some_parser = SomeipParser::new();
            match PcapngByteSource::new(fs::File::open(input)?) {
                Ok(source) => {
                    let mut some_msg_producer = MessageProducer::new(some_parser, source, None);
                    let msg_stream = some_msg_producer.as_stream();
                    pin_mut!(msg_stream);
                    let mut item_count = 0usize;
                    let mut err_count = 0usize;
                    let mut consumed = 0usize;
                    let mut skipped_count = 0usize;
                    'outer: loop {
                        let items = match msg_stream.next().await {
                            Some(items) => items,
                            None => break,
                        };
                        for item in items {
                            match item {
                                (used, MessageStreamItem::Item(_)) => {
                                    item_count += 1;
                                    consumed += used;
                                }
                                (_, MessageStreamItem::Skipped) => skipped_count += 1,
                                (_, MessageStreamItem::Incomplete) => err_count += 1,
                                (_, MessageStreamItem::Empty) => err_count += 1,
                                (_, MessageStreamItem::Done) => break 'outer,
                            }
                            if item_count > 10 || err_count > 10 {
                                println!(
                                "Someip pcap parser, item_count: {item_count}, err_count: {err_count}, consumed: {consumed} (skipped: {skipped_count})"
                            );
                                break 'outer;
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("was not a pcap file: {e}");
                }
            }
        }
        {
            println!("try pcap dlt parser");
            let dlt_parser = DltParser::new(None, None, None, false);
            // let buf_reader = BufReader::new(fs::File::open(&input)?);
            match PcapngByteSource::new(fs::File::open(input)?) {
                Ok(source) => {
                    let mut dlt_msg_producer = MessageProducer::new(dlt_parser, source, None);
                    let msg_stream = dlt_msg_producer.as_stream();
                    pin_mut!(msg_stream);
                    let mut item_count = 0usize;
                    let mut attachment_count = 0usize;
                    let mut err_count = 0usize;
                    let mut consumed = 0usize;
                    let mut skipped_count = 0usize;
                    'outer: loop {
                        let items = match msg_stream.next().await {
                            Some(items) => items,
                            None => break,
                        };
                        for item in items {
                            match item {
                                (_, MessageStreamItem::Item(ParseYield::Message(item))) => {
                                    item_count += 1;
                                    consumed += item.message.byte_len() as usize;
                                }
                                (
                                    _,
                                    MessageStreamItem::Item(ParseYield::MessageAndAttachment((
                                        item,
                                        _attachment,
                                    ))),
                                ) => {
                                    item_count += 1;
                                    consumed += item.message.byte_len() as usize;
                                }
                                (_, MessageStreamItem::Item(ParseYield::Attachment(_))) => {
                                    attachment_count += 1
                                }
                                (_, MessageStreamItem::Skipped) => skipped_count += 1,
                                (_, MessageStreamItem::Incomplete) => err_count += 1,
                                (_, MessageStreamItem::Empty) => err_count += 1,
                                (_, MessageStreamItem::Done) => break 'outer,
                            }
                            if item_count > 10 || err_count > 10 {
                                println!(
                                "DLT pcap parser, item_count: {item_count}, err_count: {err_count}, consumed: {consumed}, attachment_count: {attachment_count} (skipped: {skipped_count})"
                            );
                                break 'outer;
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("was not a pcap file: {e}");
                }
            }
        }
        {
            println!("try text parser");
            let txt_parser = StringTokenizer {};
            let buf_reader = BufReader::new(fs::File::open(input)?);
            let source = BinaryByteSource::new(buf_reader);
            let mut txt_msg_producer = MessageProducer::new(txt_parser, source, None);
            let msg_stream = txt_msg_producer.as_stream();
            pin_mut!(msg_stream);
            let mut item_count = 0usize;
            let mut err_count = 0usize;
            let mut skipped_count = 0usize;
            let mut consumed = 0usize;
            let mut attachment_count = 0usize;
            use std::io::Cursor;
            'outer: loop {
                let items = match msg_stream.next().await {
                    Some(items) => items,
                    None => break,
                };
                for item in items {
                    match item {
                        (_rest, MessageStreamItem::Item(ParseYield::Message(item))) => {
                            let mut buff = Cursor::new(vec![0; 100 * 1024]);
                            let cnt = item.to_writer(&mut buff);
                            consumed += cnt.unwrap_or(0);
                            match std::str::from_utf8(buff.get_ref()) {
                                Ok(_) => println!("valid utf8-text"),
                                Err(_) => println!("INVALID utf8-text"),
                            }

                            item_count += 1
                        }
                        (
                            _rest,
                            MessageStreamItem::Item(ParseYield::MessageAndAttachment((
                                item,
                                _attachment,
                            ))),
                        ) => {
                            let mut buff = Cursor::new(vec![0; 100 * 1024]);
                            let cnt = item.to_writer(&mut buff);
                            consumed += cnt.unwrap_or(0);
                            match std::str::from_utf8(buff.get_ref()) {
                                Ok(_) => println!("valid utf8-text"),
                                Err(_) => println!("INVALID utf8-text"),
                            }

                            item_count += 1
                        }
                        (_rest, MessageStreamItem::Item(ParseYield::Attachment(_attachment))) => {
                            attachment_count += 1
                        }
                        (_, MessageStreamItem::Skipped) => skipped_count += 1,
                        (_, MessageStreamItem::Incomplete) => err_count += 1,
                        (_, MessageStreamItem::Empty) => err_count += 1,
                        (_, MessageStreamItem::Done) => break 'outer,
                    }
                    if item_count > 10 || err_count > 10 {
                        println!(
                        "TEXT parser, item_count: {item_count}, err_count: {err_count}, skipped count: {skipped_count}, consumed: {consumed}, attachment_count: {attachment_count}"
                    );
                        break 'outer;
                    }
                }
            }
        }
        Ok(true)
    } else {
        Err(DltParseError::Unrecoverable(format!(
            "Couldn't find dlt file: {input:?}"
        )))
    }
}
