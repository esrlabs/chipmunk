extern crate dlt;
extern crate indexer_base;
extern crate neon;
#[macro_use]
extern crate log;
extern crate crossbeam_channel;
extern crate dirs;
extern crate log4rs;
extern crate merging;
extern crate processor;
extern crate serde;

mod channels;
mod concatenator_channel;
mod dlt_indexer_channel;
mod dlt_socket_channel;
mod dlt_stats_channel;
mod fibex_utils;
mod indexer_channel;
mod logging;
mod merger_channel;
mod timestamp_detector_channel;
use concatenator_channel::JsConcatenatorEmitter;
use crossbeam_channel as cc;
use dlt_indexer_channel::JsDltIndexerEventEmitter;
use dlt_socket_channel::JsDltSocketEventEmitter;
use dlt_stats_channel::JsDltStatsEventEmitter;
use indexer_base::progress::{IndexingProgress, IndexingResults};
use indexer_base::progress::{Notification, Severity};
use indexer_channel::JsIndexerEventEmitter;
use merger_channel::JsMergerEmitter;
use neon::prelude::*;
use processor::parse;
use processor::parse::timespan_in_files;
use processor::parse::DiscoverItem;
use processor::parse::TimestampFormatResult;
use timestamp_detector_channel::JsTimestampFormatDetectionEmitter;

#[no_mangle]
pub extern "C" fn __cxa_pure_virtual() {
    #[allow(clippy::empty_loop)]
    loop {}
}

pub fn init_logging() -> Result<(), std::io::Error> {
    let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
    let log_config_path = home_dir.join(".chipmunk").join("log4rs.yaml");
    if !log_config_path.exists() {
        let log_config_content = std::include_str!("../log4rs.yaml")
            .replace("$HOME_DIR", &home_dir.to_string_lossy()[..]);
        std::fs::write(&log_config_path, log_config_content)?;
    }

    log4rs::init_file(log_config_path, Default::default()).unwrap();
    info!("logging initialized");
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
        cc::Sender<IndexingResults<TimestampFormatResult>>,
        cc::Receiver<IndexingResults<TimestampFormatResult>>,
    ) = cc::unbounded();
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
                Ok(stats) => debug!("{}", stats),
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
                error!("detect_timestamp_format_in_file: couldn't process: {}", e);
            }
        }
    }
}

register_module!(mut cx, {
    init_logging().expect("logging has to be cofigured");
    // handle_discover_subcommand
    cx.export_function("detectTimestampInString", detect_timestamp_in_string)?;
    cx.export_function(
        "detectTimestampFormatInFile",
        detect_timestamp_format_in_file,
    )?;
    cx.export_class::<JsIndexerEventEmitter>("RustIndexerEventEmitter")?;
    cx.export_class::<JsDltIndexerEventEmitter>("RustDltIndexerEventEmitter")?;
    cx.export_class::<JsDltStatsEventEmitter>("RustDltStatsEventEmitter")?;
    cx.export_class::<JsDltSocketEventEmitter>("RustDltSocketEventEmitter")?;
    cx.export_class::<JsTimestampFormatDetectionEmitter>("RustTimestampFormatDetectionEmitter")?;
    cx.export_class::<JsConcatenatorEmitter>("RustConcatenatorEmitter")?;
    cx.export_class::<JsMergerEmitter>("RustMergerEmitter")?;
    // detect_timestamp_formats_in_files
    Ok(())
});
