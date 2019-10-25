#[macro_use]
extern crate neon;
extern crate dlt;
extern crate indexer_base;
#[macro_use]
extern crate log;
extern crate merging;
extern crate processor;
extern crate serde;

mod channels;
mod logging;
use crate::logging::SimpleLogger;
use channels::{
    DltStatsEventEmitter, EventEmitterTask, IndexingDltEventEmitter, IndexingEventEmitter,
    IndexingThreadConfig,
};
use neon::prelude::*;
use processor::parse;
use processor::parse::DiscoverItem;
use processor::parse::TimestampFormatResult;
use std::fs;
use std::path;
use std::sync::mpsc::{self};
use std::sync::{Arc, Mutex};

use log::{LevelFilter, SetLoggerError};

static LOGGER: SimpleLogger = SimpleLogger;

#[no_mangle]
pub extern "C" fn __cxa_pure_virtual() {
    #[allow(clippy::empty_loop)]
    loop {}
}

pub fn init_logging() -> Result<(), SetLoggerError> {
    log::set_logger(&LOGGER).map(|()| log::set_max_level(LevelFilter::Trace))?;
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
    let file_path = path::PathBuf::from(&file_name);
    match parse::detect_timestamp_format_in_file(&file_path) {
        Ok(res) => {
            let (min, max) = match parse::timespan_in_file(&res, &file_path) {
                Ok(span) => (
                    Some(parse::posix_timestamp_as_string(span.0)),
                    Some(parse::posix_timestamp_as_string(span.1)),
                ),
                _ => (None, None),
            };
            let timestamp_result = TimestampFormatResult {
                path: file_name,
                format: Some(res),
                min_time: min,
                max_time: max,
            };
            let js_value = neon_serde::to_value(&mut cx, &timestamp_result)?;
            Ok(js_value)
        }
        Err(_) => {
            let timestamp_result = TimestampFormatResult {
                path: file_name,
                format: None,
                min_time: None,
                max_time: None,
            };
            let js_value = neon_serde::to_value(&mut cx, &timestamp_result)?;
            Ok(js_value)
        }
    }
}
fn detect_timestamp_formats_in_files(mut cx: FunctionContext) -> JsResult<JsValue> {
    let arg0 = cx.argument::<JsValue>(0)?;

    let items: Vec<DiscoverItem> = neon_serde::from_value(&mut cx, arg0)?;
    debug!("received items: {:?}", items);
    let mut results: Vec<TimestampFormatResult> = Vec::new();
    for item in items {
        let file_path = path::PathBuf::from(&item.path);
        match parse::detect_timestamp_format_in_file(&file_path) {
            Ok(res) => {
                let (min, max) = match parse::timespan_in_file(&res, &file_path) {
                    Ok(span) => (
                        Some(parse::posix_timestamp_as_string(span.0)),
                        Some(parse::posix_timestamp_as_string(span.1)),
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
                error!("executed with error: {}", e)
            }
        }
    }
    let js_value = neon_serde::to_value(&mut cx, &results)?;
    Ok(js_value)
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
fn concat_files(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let concat_config_file_name = cx.argument::<JsString>(0)?.value();
    let out_path = path::PathBuf::from(cx.argument::<JsString>(1)?.value().as_str());
    let chunk_size = cx.argument::<JsNumber>(2)?.value() as usize;
    let append: bool = cx.argument::<JsBoolean>(3)?.value();
    let stdout: bool = cx.argument::<JsBoolean>(4)?.value();
    let status_updates: bool = cx.argument::<JsBoolean>(5)?.value();
    let concatenator = merging::concatenator::Concatenator {
        chunk_size, // used for mapping line numbers to byte positions
    };
    let config_path = path::PathBuf::from(concat_config_file_name);
    let concatenated_lines = match concatenator.concat_files_use_config_file(
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
    Ok(cx.number(concatenated_lines as f64))
}

// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {
    pub class JsIndexerEventEmitter for IndexingEventEmitter {
        init(mut cx) {
            let file = cx.argument::<JsString>(0)?.value();
            let tag = cx.argument::<JsString>(1)?.value();
            let out_path = path::PathBuf::from(cx.argument::<JsString>(2)?.value().as_str());
            let append: bool = cx.argument::<JsBoolean>(3)?.value();
            let timestamps: bool = cx.argument::<JsBoolean>(4)?.value();
            let chunk_size: usize = cx.argument::<JsNumber>(5)?.value() as usize;
            let (shutdown_sender, shutdown_receiver) = mpsc::channel();

            let f = match fs::File::open(&file) {
                Ok(file) => file,
                Err(_) => {
                    eprint!("could not open {}", file);
                    std::process::exit(2)
                }
            };
            let (chunk_result_sender, chunk_result_receiver) = mpsc::channel();
            let mut emitter = IndexingEventEmitter {
                event_receiver: Arc::new(Mutex::new(chunk_result_receiver)),
                shutdown_sender,
                task_thread: None,
            };
            emitter.start_indexing_in_thread(shutdown_receiver,
                chunk_result_sender,
                append,
                chunk_size,
                IndexingThreadConfig {
                    in_file: f,
                    out_path,
                    append,
                    tag,
                    timestamps,
                }
            );
            Ok(emitter)
        }

        // will be called by JS to receive data in a loop, but care should be taken to only call it once at a time.
        method poll(mut cx) {
            // The callback to be executed when data is available
            let cb = cx.argument::<JsFunction>(0)?;
            let this = cx.this();

            // Create an asynchronously `EventEmitterTask` to receive data
            let events = cx.borrow(&this, |emitter| Arc::clone(&emitter.event_receiver));
            let emitter = EventEmitterTask::new(events);

            // Schedule the task on the `libuv` thread pool
            emitter.schedule(cb);
            Ok(JsUndefined::new().upcast())
        }

        // The shutdown method may be called to stop the Rust thread. It
        // will error if the thread has already been destroyed.
        method shutdown(mut cx) {
            trace!("shutdown called");
            let this = cx.this();

            // Unwrap the shutdown channel and send a shutdown command
            cx.borrow(&this, |emitter| {
                match emitter.shutdown_sender.send(()) {
                    Err(e) => trace!("error happened when sending: {}", e),
                    Ok(()) => trace!("sent command Shutdown")
                }
            });
            Ok(JsUndefined::new().upcast())
        }
    }
    pub class JsDltIndexerEventEmitter for IndexingDltEventEmitter {
        init(mut cx) {
            trace!("Rust: JsDltIndexerEventEmitter");
            let file = cx.argument::<JsString>(0)?.value();
            let tag = cx.argument::<JsString>(1)?.value();
            let out_path = path::PathBuf::from(cx.argument::<JsString>(2)?.value().as_str());
            let append: bool = cx.argument::<JsBoolean>(3)?.value();
            let chunk_size: usize = cx.argument::<JsNumber>(4)?.value() as usize;
            let arg_filter_conf = cx.argument::<JsValue>(5)?;
            let filter_conf: dlt::filtering::DltFilterConfig = neon_serde::from_value(&mut cx, arg_filter_conf)?;
            trace!("{:?}", filter_conf);

            let shutdown_channel = mpsc::channel();
            // let (shutdown_sender, shutdown_receiver) = mpsc::channel();

            let f = match fs::File::open(&file) {
                Ok(file) => file,
                Err(_) => {
                    eprint!("could not open {}", file);
                    std::process::exit(2)
                }
            };
            let chunk_result_channel = mpsc::channel();
            let mut emitter = IndexingDltEventEmitter {
                event_receiver: Arc::new(Mutex::new(chunk_result_channel.1)),
                shutdown_sender: shutdown_channel.0,
                task_thread: None,
            };
            emitter.start_indexing_dlt_in_thread(shutdown_channel.1,
                chunk_result_channel.0,
                chunk_size,
                IndexingThreadConfig {
                    in_file: f,
                    out_path,
                    append,
                    tag,
                    timestamps: false,
                },
                Some(filter_conf)
            );
            Ok(emitter)
        }

        // will be called by JS to receive data in a loop, but care should be taken to only call it once at a time.
        method poll(mut cx) {
            // The callback to be executed when data is available
            let cb = cx.argument::<JsFunction>(0)?;
            let this = cx.this();

            // Create an asynchronously `EventEmitterTask` to receive data
            let events = cx.borrow(&this, |emitter| Arc::clone(&emitter.event_receiver));
            let emitter = EventEmitterTask::new(events);

            // Schedule the task on the `libuv` thread pool
            emitter.schedule(cb);
            Ok(JsUndefined::new().upcast())
        }

        // The shutdown method may be called to stop the Rust thread. It
        // will error if the thread has already been destroyed.
        method shutdown(mut cx) {
            trace!("shutdown called");
            let this = cx.this();

            // Unwrap the shutdown channel and send a shutdown command
            cx.borrow(&this, |emitter| {
                match emitter.shutdown_sender.send(()) {
                    Err(e) => trace!("error happened when sending: {}", e),
                    Ok(()) => trace!("sent command Shutdown")
                }
            });
            Ok(JsUndefined::new().upcast())
        }
    }
    pub class JsDltStatsEventEmitter for DltStatsEventEmitter {
        init(mut cx) {
            trace!("Rust: JsDltStatsEventEmitter");
            let file_name = cx.argument::<JsString>(0)?.value();
            let file_path = path::PathBuf::from(file_name);
            let f = match fs::File::open(&file_path) {
                Ok(file) => file,
                Err(_) => {
                    error!("could not open {:?}", file_path);
                    std::process::exit(2)
                }
            };
            let chunk_result_channel = mpsc::channel();
            let shutdown_channel = mpsc::channel();
            let mut emitter = DltStatsEventEmitter {
                event_receiver: Arc::new(Mutex::new(chunk_result_channel.1)),
                shutdown_sender: shutdown_channel.0,
                task_thread: None,
            };
            let source_file_size = match fs::metadata(file_path) {
                Ok(file_meta) => file_meta.len() as usize,
                Err(_) => {
                    error!("could not find out size of source file");
                    std::process::exit(2)
                }
            };
            emitter.start_dlt_stats_in_thread(
                f,
                source_file_size,
                shutdown_channel.1,
                chunk_result_channel.0
            );
            Ok(emitter)
        }

        // will be called by JS to receive data in a loop, but care should be taken to only call it once at a time.
        method poll(mut cx) {
            // The callback to be executed when data is available
            let cb = cx.argument::<JsFunction>(0)?;
            let this = cx.this();

            // Create an asynchronously `EventEmitterTask` to receive data
            let events = cx.borrow(&this, |emitter| Arc::clone(&emitter.event_receiver));
            let emitter = EventEmitterTask::new(events);

            // Schedule the task on the `libuv` thread pool
            emitter.schedule(cb);
            Ok(JsUndefined::new().upcast())
        }

        // The shutdown method may be called to stop the Rust thread. It
        // will error if the thread has already been destroyed.
        method shutdown(mut cx) {
            trace!("shutdown called");
            let this = cx.this();

            // Unwrap the shutdown channel and send a shutdown command
            cx.borrow(&this, |emitter| {
                match emitter.shutdown_sender.send(()) {
                    Err(e) => trace!("error happened when sending: {}", e),
                    Ok(()) => trace!("sent command Shutdown")
                }
            });
            Ok(JsUndefined::new().upcast())
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
    cx.export_function(
        "detectTimestampFormatsInFiles",
        detect_timestamp_formats_in_files,
    )?;
    cx.export_function("mergeFiles", merge_files)?;
    cx.export_function("concatFiles", concat_files)?;
    cx.export_class::<JsIndexerEventEmitter>("RustIndexerEventEmitter")?;
    cx.export_class::<JsDltIndexerEventEmitter>("RustDltIndexerEventEmitter")?;
    cx.export_class::<JsDltStatsEventEmitter>("RustDltStatsEventEmitter")?;
    Ok(())
});
