use dlt::filtering;
use indexer_base::chunks::serialize_chunks;
use indexer_base::chunks::Chunk;
use indexer_base::config::IndexingConfig;
use indexer_base::progress::IndexingProgress;
use neon::prelude::*;
use std::fs;
use std::path;
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

// Reading from a channel `Receiver` is a blocking operation. This struct
// wraps the data required to perform a read asynchronously from a libuv
// thread.
pub struct EventEmitterTask(Arc<Mutex<mpsc::Receiver<IndexingProgress<Chunk>>>>);

impl EventEmitterTask {
    pub fn new(
        event_stream: Arc<Mutex<mpsc::Receiver<IndexingProgress<Chunk>>>>,
    ) -> EventEmitterTask {
        EventEmitterTask(event_stream)
    }
}
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
            Err(RecvTimeoutError::Timeout) => Ok(None),
            Err(RecvTimeoutError::Disconnected) => {
                debug!("(libuv): did not receive a rust event in time",);
                Err("Failed to receive rust event".to_string())
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
        let event: Option<IndexingProgress<Chunk>> = event.or_else(|err| cx.throw_error(&err))?;

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

pub struct IndexingEventEmitter {
    pub event_receiver: Arc<Mutex<mpsc::Receiver<IndexingProgress<Chunk>>>>,
    pub shutdown_sender: mpsc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}

#[derive(Debug)]
pub struct IndexingThreadConfig {
    pub in_file: fs::File,
    pub out_path: path::PathBuf,
    pub append: bool,
    pub tag: String,
    pub timestamps: bool,
}
impl IndexingEventEmitter {
    pub fn start_indexing_in_thread(
        self: &mut IndexingEventEmitter,
        shutdown_rx: mpsc::Receiver<()>,
        chunk_result_sender: mpsc::Sender<IndexingProgress<Chunk>>,
        append: bool,
        mapping_out_path: path::PathBuf,
        chunk_size: usize,
        thread_conf: IndexingThreadConfig,
    ) {
        info!("call event_thread with chunk size: {}", chunk_size);

        // Spawn a thead to continue running after this method has returned.
        self.task_thread = Some(thread::spawn(move || {
            index_file_with_progress(
                IndexingConfig {
                    tag: thread_conf.tag.as_str(),
                    chunk_size,
                    in_file: thread_conf.in_file,
                    out_path: &thread_conf.out_path,
                    append,
                    to_stdout: false,
                },
                thread_conf.timestamps,
                mapping_out_path,
                Some(chunk_result_sender.clone()),
                Some(shutdown_rx),
            );
            debug!("back after indexing finished!",);
        }));
    }
}
pub struct IndexingDltEventEmitter {
    pub event_receiver: Arc<Mutex<mpsc::Receiver<IndexingProgress<Chunk>>>>,
    pub shutdown_sender: mpsc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl IndexingDltEventEmitter {
    pub fn start_indexing_dlt_in_thread(
        self: &mut IndexingDltEventEmitter,
        shutdown_rx: mpsc::Receiver<()>,
        chunk_result_sender: mpsc::Sender<IndexingProgress<Chunk>>,
        mapping_out_path: path::PathBuf,
        chunk_size: usize,
        thread_conf: IndexingThreadConfig,
        filter_conf: Option<filtering::DltFilterConfig>,
    ) {
        info!("call event_thread with chunk size: {}", chunk_size);

        // Spawn a thead to continue running after this method has returned.
        self.task_thread = Some(thread::spawn(move || {
            index_dlt_file_with_progress(
                IndexingConfig {
                    tag: thread_conf.tag.as_str(),
                    chunk_size,
                    in_file: thread_conf.in_file,
                    out_path: &thread_conf.out_path,
                    append: thread_conf.append,
                    to_stdout: false,
                },
                filter_conf,
                mapping_out_path,
                Some(chunk_result_sender.clone()),
                Some(shutdown_rx),
            );
            debug!("back after DLT indexing finished!",);
        }));
    }
}

pub fn index_dlt_file_with_progress(
    config: IndexingConfig,
    filter_conf: Option<filtering::DltFilterConfig>,
    mapping_out_path: path::PathBuf,
    tx: Option<mpsc::Sender<IndexingProgress<Chunk>>>,
    shutdown_receiver: Option<mpsc::Receiver<()>>,
) {
    trace!("index_dlt_file_with_progress");
    let source_file_size = Some(match config.in_file.metadata() {
        Ok(file_meta) => file_meta.len() as usize,
        Err(_) => {
            error!("could not find out size of source file");
            std::process::exit(2);
        }
    });
    match dlt::dlt_parse::create_index_and_mapping_dlt(
        config,
        source_file_size,
        filter_conf,
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
pub fn index_file_with_progress(
    config: IndexingConfig,
    timestamps: bool,
    mapping_out_path: path::PathBuf,
    tx: Option<mpsc::Sender<IndexingProgress<Chunk>>>,
    shutdown_receiver: Option<mpsc::Receiver<()>>,
) {
    trace!("index_file_with_progress");
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
