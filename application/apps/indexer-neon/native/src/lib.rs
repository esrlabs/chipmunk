#[macro_use]
extern crate neon;
extern crate dlt;
extern crate indexer_base;
#[macro_use]
extern crate log;
extern crate dirs;
extern crate log4rs;
extern crate merging;
extern crate processor;
extern crate serde;

mod channels;
mod concatenator_channel;
mod dlt_indexer_channel;
mod dlt_stats_channel;
mod indexer_channel;
mod logging;
mod timestamp_detector_channel;
// use crate::logging::SimpleLogger;
use concatenator_channel::JsConcatenatorEmitter;
use dlt_indexer_channel::*;
use dlt_stats_channel::JsDltStatsEventEmitter;
use indexer_base::progress::{IndexingProgress, IndexingResults};
use indexer_base::progress::{Notification, Severity};
use indexer_channel::JsIndexerEventEmitter;
use neon::prelude::*;
use processor::parse;
use processor::parse::timespan_in_files;
use processor::parse::DiscoverItem;
use processor::parse::TimestampFormatResult;
use std::path;
use std::sync::mpsc::{Receiver, Sender};
use timestamp_detector_channel::JsTimestampFormatDetectionEmitter;

use log::LevelFilter;
use log4rs::append::file::FileAppender;
use log4rs::config::{Appender, Config, Root};
use log4rs::encode::pattern::PatternEncoder;

// static LOGGER: SimpleLogger = SimpleLogger;

#[no_mangle]
pub extern "C" fn __cxa_pure_virtual() {
    #[allow(clippy::empty_loop)]
    loop {}
}

pub fn init_logging() -> Result<(), std::io::Error> {
    // log::set_logger(&LOGGER).map(|()| log::set_max_level(LevelFilter::Trace))?;
    let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
    let log_path = home_dir.join(".chipmunk").join("chipmunk.indexer.log");
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
    trace!("logging initialized");
    Ok(())
}

/// Trys to detect a valid timestamp in a string
/// Returns the a tuple of
/// * the timestamp as posix timestamp
/// * if the year was missing
///   (we assume the current year (local time) if true)
/// * the format string that was used
///
/// # Arguments
///
/// * `input` - A string slice that should be parsed
fn detect_timestamp_in_string(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let input: String = cx.argument::<JsString>(0)?.value();
    match parse::detect_timestamp_in_string(input.as_str(), None) {
        Ok((timestamp, _, _)) => Ok(cx.number((timestamp) as f64)),
        Err(e) => cx.throw_type_error(format!("{}", e)),
    }
}
fn detect_timestamp_format_in_file(mut cx: FunctionContext) -> JsResult<JsValue> {
    let file_name: String = cx.argument::<JsString>(0)?.value();
    let (tx, rx): (
        Sender<IndexingResults<TimestampFormatResult>>,
        Receiver<IndexingResults<TimestampFormatResult>>,
    ) = std::sync::mpsc::channel();
    let items: Vec<DiscoverItem> = vec![DiscoverItem {
        path: file_name.clone(),
    }];
    let err_timestamp_result = TimestampFormatResult {
        path: file_name,
        format: None,
        min_time: None,
        max_time: None,
    };
    let js_err_value = neon_serde::to_value(&mut cx, &err_timestamp_result)?;
    match timespan_in_files(items, &tx) {
        Ok(()) => (),
        Err(_e) => {
            return Ok(js_err_value);
        }
    };
    loop {
        match rx.recv() {
            Ok(Ok(IndexingProgress::GotItem { item: res })) => match serde_json::to_string(&res) {
                Ok(stats) => println!("{}", stats),
                Err(_e) => {
                    return Ok(js_err_value);
                }
            },
            Ok(Ok(IndexingProgress::Progress { ticks: t })) => {
                trace!("progress... ({:.1} %)", (t.0 as f64 / t.1 as f64) * 100.0);
            }
            Ok(Ok(IndexingProgress::Finished)) => {
                trace!("finished...");
            }
            Ok(Err(Notification {
                severity,
                content,
                line,
            })) => {
                if severity == Severity::WARNING {
                    warn!("{:?}: {}", line, content);
                } else {
                    error!("{:?}: {}", line, content);
                }
            }
            Ok(Ok(IndexingProgress::Stopped)) => {
                trace!("stopped...");
            }
            Err(e) => {
                error!("couldn't process: {}", e);
            }
        }
    }
}

fn merge_files(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let merge_config_file_name = cx.argument::<JsString>(0)?.value();
    let out_path = path::PathBuf::from(cx.argument::<JsString>(1)?.value().as_str());
    let chunk_size = cx.argument::<JsNumber>(2)?.value() as usize;
    let append: bool = cx.argument::<JsBoolean>(3)?.value();
    let stdout: bool = cx.argument::<JsBoolean>(4)?.value();
    let status_updates: bool = cx.argument::<JsBoolean>(5)?.value();
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
            error!("error merging: {}", e);
            std::process::exit(2)
        }
    };
    Ok(cx.number(merged_lines as f64))
}

register_module!(mut cx, {
    init_logging().expect("logging has to be cofigured");
    // handle_discover_subcommand
    cx.export_function("detectTimestampInString", detect_timestamp_in_string)?;
    cx.export_function(
        "detectTimestampFormatInFile",
        detect_timestamp_format_in_file,
    )?;
    cx.export_function("mergeFiles", merge_files)?;
    // cx.export_function("concatFiles", concat_files)?;
    cx.export_class::<JsIndexerEventEmitter>("RustIndexerEventEmitter")?;
    cx.export_class::<JsDltIndexerEventEmitter>("RustDltIndexerEventEmitter")?;
    cx.export_class::<JsDltStatsEventEmitter>("RustDltStatsEventEmitter")?;
    cx.export_class::<JsTimestampFormatDetectionEmitter>("RustTimestampFormatDetectionEmitter")?;
    cx.export_class::<JsConcatenatorEmitter>("RustConcatenatorEmitter")?;
    // detect_timestamp_formats_in_files
    Ok(())
});
