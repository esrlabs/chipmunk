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
mod dlt_pcap_channel;
mod dlt_socket_channel;
mod dlt_stats_channel;
mod export_channel;
mod fibex_utils;
mod format_verify_channel;
mod indexer_channel;
mod logging;
mod merger_channel;
mod timestamp_detector_channel;
mod timestamp_extractor_channel;
use crate::{
    dlt_pcap_channel::JsDltPcapEventEmitter, format_verify_channel::JsFormatVerificationEmitter,
};
use anyhow::Result;
use concatenator_channel::JsConcatenatorEmitter;
use dlt_indexer_channel::JsDltIndexerEventEmitter;
use dlt_socket_channel::JsDltSocketEventEmitter;

use dlt_stats_channel::JsDltStatsEventEmitter;
use export_channel::JsExporterEventEmitter;
use indexer_channel::JsIndexerEventEmitter;
use log::LevelFilter;
use log4rs::{
    append::file::FileAppender,
    config::{Appender, Config, Root},
    encode::pattern::PatternEncoder,
};
use merger_channel::JsMergerEmitter;
use neon::prelude::*;
use processor::parse::{self};
use std::fs;
use std::io::prelude::*;
use timestamp_detector_channel::JsTimestampFormatDetectionEmitter;
use timestamp_extractor_channel::JsTimestampExtractEmitter;

use neon::context::Context;

#[no_mangle]
pub extern "C" fn __cxa_pure_virtual() {
    #[allow(clippy::empty_loop)]
    loop {}
}

pub fn init_logging() -> Result<()> {
    let home_dir = dirs::home_dir().expect("we need to have access to home-dir");
    let log_file_path = home_dir.join(".chipmunk").join("chipmunk.indexer.log");
    let log_config_path = home_dir.join(".chipmunk").join("log4rs.yaml");
    if !log_config_path.exists() {
        let log_config_content = std::include_str!("../log4rs.yaml")
            .replace("$LOG_FILE_PATH", &log_file_path.to_string_lossy())
            .replace("$HOME_DIR", &home_dir.to_string_lossy());

        match std::fs::write(&log_config_path, log_config_content) {
            Ok(_) => (),
            Err(e) => eprintln!("error while trying to write log config file: {}", e),
        }
    } else {
        // make sure the env variables are correctly replaced
        let mut content = String::new();
        {
            let mut log_config_file = fs::File::open(&log_config_path)?;
            log_config_file.read_to_string(&mut content)?;
        }
        let log_config_content = content
            .replace("$LOG_FILE_PATH", &log_file_path.to_string_lossy())
            .replace("$HOME_DIR", &home_dir.to_string_lossy());

        match fs::write(&log_config_path, &log_config_content) {
            Ok(_) => println!("Neon: replaced file with:\n{}", log_config_content),
            Err(e) => eprintln!("error while trying to write log config file: {}", e),
        }
    }

    match log4rs::init_file(&log_config_path, Default::default()) {
        Ok(_) => println!(
            "Successfully initialized logging from {:?}",
            log_config_path
        ),
        Err(e) => {
            eprintln!("could not initialize logging with init_file: {}", e);
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
                        .build(LevelFilter::Warn),
                )
                .expect("logging config was incorrect");
            anyhow::Context::with_context(log4rs::init_config(config), || {
                "logging config could not be applied"
            })?;
            println!("Initialized logging from fallback config");
        }
    }
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

register_module!(mut cx, {
    init_logging().expect("logging has to be cofigured");
    // handle_discover_subcommand
    cx.export_function("detectTimestampInString", detect_timestamp_in_string)?;
    cx.export_class::<JsIndexerEventEmitter>("RustIndexerEventEmitter")?;
    cx.export_class::<JsDltIndexerEventEmitter>("RustDltIndexerEventEmitter")?;
    cx.export_class::<JsDltPcapEventEmitter>("RustDltPcapEventEmitter")?;
    cx.export_class::<JsDltStatsEventEmitter>("RustDltStatsEventEmitter")?;
    cx.export_class::<JsDltSocketEventEmitter>("RustDltSocketEventEmitter")?;
    cx.export_class::<JsTimestampFormatDetectionEmitter>("RustTimestampFormatDetectionEmitter")?;
    cx.export_class::<JsTimestampExtractEmitter>("RustTimestampExtractEmitter")?;
    cx.export_class::<JsConcatenatorEmitter>("RustConcatenatorEmitter")?;
    cx.export_class::<JsMergerEmitter>("RustMergerEmitter")?;
    cx.export_class::<JsExporterEventEmitter>("RustExporterEventEmitter")?;
    cx.export_class::<JsFormatVerificationEmitter>("RustFormatVerificationEmitter")?;

    // detect_timestamp_formats_in_files
    Ok(())
});
