use crate::channels::EventEmitterTask;
use crate::channels::SocketThreadConfig;
use crate::fibex_utils::gather_fibex_data;
use crossbeam_channel as cc;
use dlt::fibex::FibexMetadata;
use dlt::filtering;
use indexer_base::chunks::ChunkResults;
use indexer_base::config::FibexConfig;
use indexer_base::config::SocketConfig;
use neon::prelude::*;
use std::path;
use std::rc::Rc;
use std::sync::{Arc, Mutex};
use std::thread;

pub struct SocketDltEventEmitter {
    pub event_receiver: Arc<Mutex<cc::Receiver<ChunkResults>>>,
    pub shutdown_sender: async_std::sync::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl SocketDltEventEmitter {
    pub fn start_indexing_socket_in_thread(
        self: &mut SocketDltEventEmitter,
        shutdown_rx: async_std::sync::Receiver<()>,
        chunk_result_sender: cc::Sender<ChunkResults>,
        thread_conf: SocketThreadConfig,
        socket_conf: SocketConfig,
        filter_conf: Option<filtering::DltFilterConfig>,
        fibex: FibexConfig,
    ) {
        info!("start_indexing_socket_in_thread: {:?}", thread_conf);

        // Spawn a thread to continue running after this method has returned.
        self.task_thread = Some(thread::spawn(move || {
            let fibex_metadata: Option<Rc<FibexMetadata>> = gather_fibex_data(fibex);
            match dlt::dlt_parse::create_index_and_mapping_dlt_from_socket(
                socket_conf,
                thread_conf.tag.as_str(),
                thread_conf.ecu_id,
                &thread_conf.out_path,
                filter_conf,
                &chunk_result_sender,
                shutdown_rx,
                fibex_metadata,
            ) {
                Ok(_) => {}
                Err(e) => warn!("error for socket dlt stream: {}", e),
            }
            debug!("back after DLT indexing finished!");
        }));
    }
}

// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {
    pub class JsDltSocketEventEmitter for SocketDltEventEmitter {
        init(mut cx) {
            trace!("Rust: JsDltSocketEventEmitter");
            let ecu_id = cx.argument::<JsString>(0)?.value();
            let arg_socket_conf = cx.argument::<JsValue>(1)?;
            trace!("Rust: 1");
            let socket_conf: SocketConfig = neon_serde::from_value(&mut cx, arg_socket_conf)?;
            trace!("Rust: 2");
            let tag = cx.argument::<JsString>(2)?.value();
            trace!("Rust: 3");
            let out_path = path::PathBuf::from(cx.argument::<JsString>(3)?.value().as_str());
            trace!("Rust: 4");
            let arg_filter_conf = cx.argument::<JsValue>(4)?;
            trace!("Rust: 5");
            let filter_conf: dlt::filtering::DltFilterConfig = neon_serde::from_value(&mut cx, arg_filter_conf)?;
            trace!("Rust: 6");

            let arg_fibex_conf = cx.argument::<JsValue>(5)?;
            trace!("Rust: 7");
            let fibex_conf: FibexConfig = neon_serde::from_value(&mut cx, arg_fibex_conf)?;
            trace!("Rust: 8");

            let shutdown_channel = async_std::sync::channel(1);
            let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();
            let mut emitter = SocketDltEventEmitter {
                event_receiver: Arc::new(Mutex::new(rx)),
                shutdown_sender: shutdown_channel.0,
                task_thread: None,
            };

            emitter.start_indexing_socket_in_thread(
                shutdown_channel.1,
                tx,
                SocketThreadConfig {
                    out_path,
                    tag,
                    ecu_id,
                },
                socket_conf,
                Some(filter_conf),
                fibex_conf,
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
                async_std::task::block_on(
                    async {
                        emitter.shutdown_sender.send(()).await;
                        trace!("sent command Shutdown")
                    }
                );
            });
            Ok(JsUndefined::new().upcast())
        }
    }
}
