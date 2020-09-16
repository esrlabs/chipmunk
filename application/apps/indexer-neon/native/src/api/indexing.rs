use crate::{channels::EventEmitterTask, config::IndexingThreadConfig};
use crossbeam_channel as cc;
use indexer_base::{
    chunks::ChunkResults,
    config::IndexingConfig,
    progress::{Notification, Severity},
};
use neon::prelude::*;
use std::{path, thread};

pub struct IndexingEventEmitter {
    pub event_receiver: cc::Receiver<ChunkResults>,
    pub shutdown_sender: cc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl IndexingEventEmitter {
    pub fn start_indexing_in_thread(
        self: &mut IndexingEventEmitter,
        shutdown_rx: cc::Receiver<()>,
        chunk_result_sender: cc::Sender<ChunkResults>,
        append: bool,
        chunk_size: usize,
        thread_conf: IndexingThreadConfig,
    ) {
        info!("call event_thread with chunk size: {}", chunk_size);

        // Spawn a thread to continue running after this method has returned.
        self.task_thread = Some(thread::spawn(move || {
            let index_future = index_file_with_progress(
                IndexingConfig {
                    tag: thread_conf.tag,
                    chunk_size,
                    in_file: thread_conf.in_file,
                    out_path: thread_conf.out_path,
                    append,
                    watch: false,
                },
                thread_conf.timestamps,
                chunk_result_sender.clone(),
                Some(shutdown_rx),
            );

            async_std::task::block_on(async {
                index_future.await;
            });
            debug!("back after indexing finished!",);
        }));
    }
}

async fn index_file_with_progress(
    config: IndexingConfig,
    timestamps: bool,
    tx: cc::Sender<ChunkResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
) {
    trace!("index_file_with_progress");
    let source_file_size = match config.in_file.metadata() {
        Ok(file_meta) => file_meta.len(),
        Err(_) => {
            error!("could not find out size of source file");
            let _ = tx.try_send(Err(Notification {
                severity: Severity::WARNING,
                content: "could not find out size of source file".to_string(),
                line: None,
            }));
            0
        }
    };
    match processor::processor::create_index_and_mapping(
        config,
        source_file_size,
        timestamps,
        tx.clone(),
        shutdown_receiver,
    )
    .await
    {
        Err(why) => {
            error!("create_index_and_mapping: couldn't process: {}", why);
            let _ = tx.try_send(Err(Notification {
                severity: Severity::WARNING,
                content: format!("couldn't process: {}", why),
                line: None,
            }));
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
            let (shutdown_sender, shutdown_receiver) = cc::unbounded();

            let file_path = path::PathBuf::from(file);
            let (chunk_result_sender, chunk_result_receiver): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();
            let mut emitter = IndexingEventEmitter {
                event_receiver: chunk_result_receiver,
                shutdown_sender,
                task_thread: None,
            };
            emitter.start_indexing_in_thread(shutdown_receiver,
                chunk_result_sender,
                append,
                chunk_size,
                IndexingThreadConfig {
                    in_file: file_path,
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
            let events = cx.borrow(&this, |emitter| emitter.event_receiver.clone());
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
