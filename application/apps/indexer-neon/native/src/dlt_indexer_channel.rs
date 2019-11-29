use channels::{EventEmitterTask, IndexingThreadConfig};
use crossbeam_channel as cc;
use dlt::fibex::FibexMetadata;
use dlt::filtering;
use indexer_base::chunks::ChunkResults;
use indexer_base::config::IndexingConfig;
use indexer_base::progress::{Notification, Severity};
use neon::prelude::*;
use std::fs;
use std::path;
use std::rc::Rc;
use std::sync::{Arc, Mutex};
use std::thread;

pub struct IndexingDltEventEmitter {
    pub event_receiver: Arc<Mutex<cc::Receiver<ChunkResults>>>,
    pub shutdown_sender: cc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl IndexingDltEventEmitter {
    pub fn start_indexing_dlt_in_thread(
        self: &mut IndexingDltEventEmitter,
        shutdown_rx: cc::Receiver<()>,
        chunk_result_sender: cc::Sender<ChunkResults>,
        chunk_size: usize,
        thread_conf: IndexingThreadConfig,
        filter_conf: Option<filtering::DltFilterConfig>,
        fibex: Option<String>,
    ) {
        info!("start_indexing_dlt_in_thread: {:?}", thread_conf);

        // Spawn a thead to continue running after this method has returned.
        self.task_thread = Some(thread::spawn(move || {
            let fibex_metadata: Option<Rc<FibexMetadata>> = match fibex {
                None => None,
                Some(fibex_path) => {
                    let path = &std::path::PathBuf::from(fibex_path);
                    match dlt::fibex::read_fibex(path) {
                        Ok(res) => Some(std::rc::Rc::new(res)),
                        Err(e) => {
                            warn!("error reading fibex {}", e);
                            None
                        }
                    }
                }
            };
            index_dlt_file_with_progress(
                IndexingConfig {
                    tag: thread_conf.tag.as_str(),
                    chunk_size,
                    in_file: thread_conf.in_file,
                    out_path: &thread_conf.out_path,
                    append: thread_conf.append,
                },
                filter_conf,
                chunk_result_sender.clone(),
                Some(shutdown_rx),
                fibex_metadata,
            );
            debug!("back after DLT indexing finished!");
        }));
    }
}

fn index_dlt_file_with_progress(
    config: IndexingConfig,
    filter_conf: Option<filtering::DltFilterConfig>,
    tx: cc::Sender<ChunkResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
) {
    trace!("index_dlt_file_with_progress");
    let source_file_size = Some(match config.in_file.metadata() {
        Ok(file_meta) => file_meta.len() as usize,
        Err(_) => {
            error!("could not find out size of source file");
            let _ = tx.try_send(Err(Notification {
                severity: Severity::WARNING,
                content: "could not find out size of source file".to_string(),
                line: None,
            }));
            0
        }
    });
    match dlt::dlt_parse::create_index_and_mapping_dlt(
        config,
        source_file_size,
        filter_conf,
        tx,
        shutdown_receiver,
        fibex_metadata,
    ) {
        Err(why) => {
            error!("couldn't process: {}", why);
        }
        Ok(_) => trace!("create_index_and_mapping_dlt returned ok"),
    }
}
// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {
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
            let mut fibex: Option<String> = None;
            if let Some(arg) = cx.argument_opt(6) {
                if arg.is_a::<JsString>() {
                    fibex = Some(arg.downcast::<JsString>().or_throw(&mut cx)?.value());
                } else if arg.is_a::<JsUndefined>() {
                    trace!("fibex arg was not set");
                }
            }

            let shutdown_channel = cc::unbounded();
            let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();
            let mut emitter = IndexingDltEventEmitter {
                event_receiver: Arc::new(Mutex::new(rx)),
                shutdown_sender: shutdown_channel.0,
                task_thread: None,
            };

            let f = match fs::File::open(&file) {
                Ok(file) => file,
                Err(e) => {
                    eprint!("could not open {}", file);
                    let _ = tx.try_send(Err(Notification {
                        severity: Severity::WARNING,
                        content: format!("could not open file ({})", e),
                        line: None,
                    }));
                    std::process::exit(2)
                }
            };
            emitter.start_indexing_dlt_in_thread(shutdown_channel.1,
                tx,
                chunk_size,
                IndexingThreadConfig {
                    in_file: f,
                    out_path,
                    append,
                    tag,
                    timestamps: false,
                },
                Some(filter_conf),
                fibex,
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
