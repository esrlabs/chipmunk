#[macro_use]
extern crate neon;
extern crate dlt;
extern crate indexer_base;
#[macro_use]
extern crate log;
extern crate merging;
extern crate processor;
extern crate serde;

mod logging;
use crate::logging::SimpleLogger;
use indexer_base::chunks::{serialize_chunks, Chunk};
use indexer_base::config::IndexingConfig;
use indexer_base::progress::IndexingProgress;
use neon::prelude::*;
use processor::parse;
use processor::parse::DiscoverItem;
use processor::parse::TimestampFormatResult;
use std::fs;
use std::path;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

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
                path: file_name.to_string(),
                format: Some(res.clone()),
                min_time: min,
                max_time: max,
            };
            let js_value = neon_serde::to_value(&mut cx, &timestamp_result)?;
            Ok(js_value)
        }
        Err(_) => {
            let timestamp_result = TimestampFormatResult {
                path: file_name.to_string(),
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

fn index_file_cx(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let file = cx.argument::<JsString>(0)?.value();
    let tag = cx.argument::<JsString>(1)?.value();
    let out_path = path::PathBuf::from(cx.argument::<JsString>(2)?.value().as_str());
    let chunk_size = cx.argument::<JsNumber>(3)?.value() as usize;
    let append: bool = cx.argument::<JsBoolean>(4)?.value();
    let stdout: bool = cx.argument::<JsBoolean>(5)?.value();
    let timestamps: bool = cx.argument::<JsBoolean>(6)?.value();
    let mapping_out_path: path::PathBuf = path::PathBuf::from(file.to_string() + ".map.json");
    let f = match fs::File::open(&file) {
        Ok(file) => file,
        Err(_) => {
            error!("could not open {:?}", file);
            std::process::exit(2)
        }
    };
    let config = IndexingConfig {
        tag: tag.as_str(),
        chunk_size,
        in_file: f,
        out_path: &out_path,
        append,
        to_stdout: stdout,
    };
    index_file(config, timestamps, mapping_out_path, None, None);
    Ok(cx.boolean(true))
}

fn index_file(
    config: IndexingConfig,
    timestamps: bool,
    mapping_out_path: path::PathBuf,
    tx: Option<mpsc::Sender<IndexingProgress<Chunk>>>,
    shutdown_receiver: Option<mpsc::Receiver<()>>,
) {
    info!("index_file in new thread");

    let source_file_size = Some(match config.in_file.metadata() {
        Ok(file_meta) => file_meta.len() as usize,
        Err(_) => {
            error!("could not find out size of source file");
            std::process::exit(2);
        }
    });
    match processor::processor::create_index_and_mapping(
        config,
        timestamps,
        source_file_size,
        tx,
        shutdown_receiver,
    ) {
        Err(why) => {
            error!("couldn't process: {}", why);
            std::process::exit(2)
        }
        Ok(chunks) => {
            let _ = serialize_chunks(&chunks, &mapping_out_path);
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
fn index_dlt_file(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let file_name = cx.argument::<JsString>(0)?.value();
    let tag = cx.argument::<JsString>(1)?.value();
    let out_path = path::PathBuf::from(cx.argument::<JsString>(2)?.value().as_str());
    let chunk_size = cx.argument::<JsNumber>(3)?.value() as usize;
    let append: bool = cx.argument::<JsBoolean>(4)?.value();
    let stdout: bool = cx.argument::<JsBoolean>(5)?.value();

    let args_length = cx.len();
    let filter_conf: Option<dlt::filtering::DltFilterConfig> = if args_length == 8 {
        let conf_arg = cx.argument::<JsValue>(7)?;
        Some(neon_serde::from_value(&mut cx, conf_arg)?)
    } else {
        None
    };
    debug!("filter-conf used: {:?}", filter_conf);

    let mapping_out_path: path::PathBuf = path::PathBuf::from(file_name.to_string() + ".map.json");
    let file_path = path::PathBuf::from(&file_name);
    let f = match fs::File::open(&file_path) {
        Ok(file) => file,
        Err(_) => {
            error!("could not open {:?}", file_path);
            std::process::exit(2)
        }
    };

    match dlt::dlt_parse::create_index_and_mapping_dlt(
        IndexingConfig {
            tag: tag.as_str(),
            chunk_size,
            in_file: f,
            out_path: &out_path,
            append,
            to_stdout: stdout,
        },
        None,
        filter_conf,
        None,
    ) {
        Err(why) => {
            error!("couldn't process: {}", why);
            std::process::exit(2)
        }
        Ok(chunks) => {
            let _ = serialize_chunks(&chunks, &mapping_out_path);
            Ok(cx.boolean(true))
        }
    }
}
fn dlt_stats(mut cx: FunctionContext) -> JsResult<JsValue> {
    let file_name = cx.argument::<JsString>(0)?.value();
    let file_path = path::PathBuf::from(file_name);
    let f = match fs::File::open(&file_path) {
        Ok(file) => file,
        Err(_) => {
            error!("could not open {:?}", file_path);
            std::process::exit(2)
        }
    };
    match dlt::dlt_parse::get_dlt_file_info(&f) {
        Err(why) => {
            error!("couldn't collect statistics: {}", why);
            std::process::exit(2)
        }
        Ok(res) => {
            let js_value = neon_serde::to_value(&mut cx, &res)?;
            Ok(js_value)
        }
    }
}
// Represents the data that will be received by the `poll` method. It may
// include different types of data or be replaced with a more simple type,
// e.g., `Vec<u8>`.
// pub enum Event {
//     Tick {
//         count: f64,
//     },
//     ChunkEvent {
//         rows: (usize, usize),
//         bytes: (usize, usize),
//     },
// }
// Rust struct that holds the data required by the `JsEventEmitter` class.
pub struct IndexingEventEmitter {
    // Since the `Receiver` is sent to a thread and mutated, it must be
    // `Send + Sync`. Since, correct usage of the `poll` interface should
    // only have a single concurrent consume, we guard the channel with a
    // `Mutex`.
    events: Arc<Mutex<mpsc::Receiver<IndexingProgress<Chunk>>>>,

    // Channel used to perform a controlled shutdown of the work thread.
    shutdown_sender: mpsc::Sender<()>,
    task_thread: Option<std::thread::JoinHandle<()>>,
}
impl IndexingEventEmitter {
    fn event_thread(
        self: &mut IndexingEventEmitter,
        shutdown_rx: mpsc::Receiver<()>,
        chunk_result_sender: mpsc::Sender<IndexingProgress<Chunk>>,
        file: fs::File,
        timestamps: bool,
        tag: String,
        append: bool,
        out_path: path::PathBuf,
        mapping_out_path: path::PathBuf,
        chunk_size: usize,
    ) {
        info!("call event_thread with chunk size: {}", chunk_size);
        // let (chunk_result_sender, chunk_result_receiver) = mpsc::channel();

        // Spawn a thead to continue running after this method has returned.
        self.task_thread = Some(thread::spawn(move || {
            index_file(
                IndexingConfig {
                    tag: tag.as_str(),
                    chunk_size,
                    in_file: file,
                    out_path: &out_path,
                    append,
                    to_stdout: false,
                },
                timestamps,
                mapping_out_path,
                // None,
                Some(chunk_result_sender.clone()),
                Some(shutdown_rx),
            );
            debug!("back after indexing finished!!!!!!!!",);
            // match chunk_result_sender.send(IndexingProgress::Finished) {
            //     Ok(()) => debug!("sent final finished successfully",),
            //     Err(e) => debug!("error sending final finished: {}", e),
            // }
        }));

        // chunk_result_receiver
    }
}
// Reading from a channel `Receiver` is a blocking operation. This struct
// wraps the data required to perform a read asynchronously from a libuv
// thread.
pub struct EventEmitterTask(Arc<Mutex<mpsc::Receiver<IndexingProgress<Chunk>>>>);

// Implementation of a neon `Task` for `EventEmitterTask`. This task reads
// from the events channel and calls a JS callback with the data.
impl Task for EventEmitterTask {
    type Output = Option<IndexingProgress<Chunk>>;
    type Error = String;
    type JsEvent = JsValue;

    // The work performed on the `libuv` thread. First acquire a lock on
    // the receiving thread and then return the received data.
    // In practice, this should never need to wait for a lock since it
    // should only be executed one at a time by the `EventEmitter` class.
    fn perform(&self) -> Result<Self::Output, Self::Error> {
        // debug!("perform rs");
        let rx = self
            .0
            .lock()
            .map_err(|_| "Could not obtain lock on receiver".to_string())?;

        // Attempt to read from the channel. Block for at most 100 ms.
        match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(event) => {
                match event {
                    IndexingProgress::GotItem { .. } => (),
                    _ => {
                        debug!("(libuv): OK({:?})", &event);
                    }
                };
                Ok(Some(event))
            }
            Err(RecvTimeoutError::Timeout) => {
                // debug!(
                //     "(libuv): Err(RecvTimeoutError::Timeout)",
                // );
                Ok(None)
            }
            Err(RecvTimeoutError::Disconnected) => {
                debug!("(libuv): Failed to receive event",);
                Err("Failed to receive event".to_string())
            }
        }
    }

    // After the `perform` method has returned, the `complete` method is
    // scheduled on the main thread. It is responsible for converting the
    // Rust data structure into a JS object.
    fn complete(
        self,
        mut cx: TaskContext,
        event: Result<Self::Output, Self::Error>,
    ) -> JsResult<Self::JsEvent> {
        // debug!("complete rs");
        // Receive the event or return early with the error
        let event: Option<IndexingProgress<Chunk>> =
            event.or_else(|err| cx.throw_error(&err.to_string()))?;

        // Timeout occured, return early with `undefined
        let event: IndexingProgress<Chunk> = match event {
            Some(event) => event,
            None => return Ok(JsUndefined::new().upcast()),
        };
        // Create an empty object `{}`
        let o = cx.empty_object();
        match event {
            IndexingProgress::Progress { ticks: (n, total) } => {
                let event_name = cx.string("Progress");
                let ticked = cx.number(n as f64);
                let total = cx.number(total as f64);

                o.set(&mut cx, "event", event_name)?;
                o.set(&mut cx, "ellapsed", ticked)?;
                o.set(&mut cx, "total", total)?;
            }
            IndexingProgress::GotItem { item: chunk } => {
                let event_name = cx.string("GotItem");
                let rows_start = cx.number(chunk.r.0 as f64);
                let rows_end = cx.number(chunk.r.1 as f64);
                let bytes_start = cx.number(chunk.b.0 as f64);
                let bytes_end = cx.number(chunk.b.1 as f64);

                o.set(&mut cx, "event", event_name)?;
                o.set(&mut cx, "rows_start", rows_start)?;
                o.set(&mut cx, "rows_end", rows_end)?;
                o.set(&mut cx, "bytes_start", bytes_start)?;
                o.set(&mut cx, "bytes_end", bytes_end)?;
            }
            IndexingProgress::Stopped => {
                trace!("rust: propagate stopped event");
                let event_name = cx.string("Stopped");
                o.set(&mut cx, "event", event_name)?;
            }
            IndexingProgress::Finished => {
                trace!("rust IndexingProgress::Finished");
                let event_name = cx.string("Finished");
                o.set(&mut cx, "event", event_name)?;
            }
        }

        Ok(o.upcast())
    }
}

// Implementation of the `JsEventEmitter` class. This is the only public
// interface of the Rust code. It exposes the `poll` and `shutdown` methods
// to JS.
declare_types! {
    pub class JsEventEmitter for IndexingEventEmitter {
        // Called by the `JsEventEmitter` constructor
        init(mut cx) {
            let file = cx.argument::<JsString>(0)?.value();
            let tag = cx.argument::<JsString>(1)?.value();
            let out_path = path::PathBuf::from(cx.argument::<JsString>(2)?.value().as_str());
            let append: bool = cx.argument::<JsBoolean>(3)?.value();
            let timestamps: bool = cx.argument::<JsBoolean>(4)?.value();
            let chunk_size: usize = cx.argument::<JsNumber>(5)?.value() as usize;
            let mapping_out_path: path::PathBuf = path::PathBuf::from(file.to_string() + ".map.json");
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
                events: Arc::new(Mutex::new(chunk_result_receiver)),
                shutdown_sender,
                task_thread: None,
            };
            // Start work in a separate thread
            emitter.event_thread(shutdown_receiver,
                chunk_result_sender,
                f,
                timestamps,
                tag,
                append,
                out_path,
                mapping_out_path,
                chunk_size,
            );

            // Construct a new `EventEmitter` to be wrapped by the class.
            Ok(emitter)
        }

        // This method should be called by JS to receive data. It accepts a
        // `function (err, data)` style asynchronous callback. It may be called
        // in a loop, but care should be taken to only call it once at a time.
        method poll(mut cx) {
            // The callback to be executed when data is available
            let cb = cx.argument::<JsFunction>(0)?;
            let this = cx.this();

            // Create an asynchronously `EventEmitterTask` to receive data
            let events = cx.borrow(&this, |emitter| Arc::clone(&emitter.events));
            let emitter = EventEmitterTask(events);

            // Schedule the task on the `libuv` thread pool
            emitter.schedule(cb);

            // The `poll` method does not return any data.
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
    // cx.export_function("indexFile", index_file)?;
    cx.export_function("mergeFiles", merge_files)?;
    cx.export_function("concatFiles", concat_files)?;
    cx.export_function("indexDltFile", index_dlt_file)?;
    cx.export_function("indexFile", index_file_cx)?;
    cx.export_function("dltStats", dlt_stats)?;
    cx.export_class::<JsEventEmitter>("REventEmitter")?;
    Ok(())
});
