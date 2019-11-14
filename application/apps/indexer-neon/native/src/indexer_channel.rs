use channels::{EventEmitterTask, IndexingThreadConfig};
use indexer_base::chunks::ChunkResults;
use indexer_base::config::IndexingConfig;
use neon::prelude::*;
use std::fs;
use std::path;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

pub struct IndexingEventEmitter {
    pub event_receiver: Arc<Mutex<mpsc::Receiver<ChunkResults>>>,
    pub shutdown_sender: mpsc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl IndexingEventEmitter {
    pub fn start_indexing_in_thread(
        self: &mut IndexingEventEmitter,
        shutdown_rx: mpsc::Receiver<()>,
        chunk_result_sender: mpsc::Sender<ChunkResults>,
        append: bool,
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
                },
                thread_conf.timestamps,
                chunk_result_sender.clone(),
                Some(shutdown_rx),
            );
            debug!("back after indexing finished!",);
        }));
    }
}

fn index_file_with_progress(
    config: IndexingConfig,
    timestamps: bool,
    tx: mpsc::Sender<ChunkResults>,
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
        Ok(_) => trace!("create_index_and_mapping returned ok"),
    }
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
            let (chunk_result_sender, chunk_result_receiver): (Sender<ChunkResults>, Receiver<ChunkResults>) = mpsc::channel();
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
}
