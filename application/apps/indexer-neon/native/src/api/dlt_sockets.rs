use crate::{channels::EventEmitterTask, fibex_utils::gather_fibex_data};
use crossbeam_channel as cc;
use dlt::{fibex::FibexMetadata, filtering};
use indexer_base::{
    chunks::ChunkResults,
    config::{FibexConfig, SocketConfig},
};
use neon::prelude::*;
use std::{path, thread};
use tokio::sync;

#[derive(Debug)]
pub struct SocketThreadConfig {
    pub out_path: path::PathBuf,
    pub tag: String,
}
pub struct SocketDltEventEmitter {
    pub event_receiver: cc::Receiver<ChunkResults>,
    pub shutdown_sender: sync::mpsc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl SocketDltEventEmitter {
    #[allow(clippy::too_many_arguments)]
    pub fn start_indexing_socket_in_thread(
        self: &mut SocketDltEventEmitter,
        session_id: String,
        shutdown_rx: sync::mpsc::Receiver<()>,
        chunk_result_sender: cc::Sender<ChunkResults>,
        thread_conf: SocketThreadConfig,
        socket_conf: SocketConfig,
        filter_conf: Option<filtering::DltFilterConfig>,
        fibex: FibexConfig,
    ) {
        info!("start_indexing_socket_in_thread: {:?}", thread_conf);
        use tokio::runtime::Runtime;
        // Create the runtime
        let rt = Runtime::new().expect("Could not create runtime");

        // Spawn a thread to continue running after this method has returned.
        self.task_thread = Some(thread::spawn(move || {
            let fibex_metadata: Option<FibexMetadata> = gather_fibex_data(fibex);
            let socket_future = dlt::dlt_net::create_index_and_mapping_dlt_from_socket(
                session_id,
                socket_conf,
                thread_conf.tag.as_str(),
                &thread_conf.out_path,
                filter_conf,
                &chunk_result_sender,
                shutdown_rx,
                fibex_metadata,
            );
            rt.block_on(async {
                match socket_future.await {
                    Ok(_) => {}
                    Err(e) => warn!("error for socket dlt stream: {}", e),
                }
            });
            debug!("back after DLT indexing finished!");
        }));
    }
}

// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {
    pub class JsDltSocketEventEmitter for SocketDltEventEmitter {
        init(mut cx) {
            trace!("Rust: JsDltSocketEventEmitter");
            let session_id = cx.argument::<JsString>(0)?.value();
            let arg_socket_conf = cx.argument::<JsString>(1)?.value();
            let socket_conf: Result<SocketConfig, serde_json::Error> = serde_json::from_str(arg_socket_conf.as_str());
            let tag = cx.argument::<JsString>(2)?.value();
            let out_path = path::PathBuf::from(cx.argument::<JsString>(3)?.value().as_str());
            let arg_filter_conf = cx.argument::<JsString>(4)?.value();

            let filter_conf: Result<dlt::filtering::DltFilterConfig, serde_json::Error> =
                serde_json::from_str(arg_filter_conf.as_str());

            let arg_fibex_conf = cx.argument::<JsString>(5)?.value();
            let fibex_conf: Result<FibexConfig, serde_json::Error> = serde_json::from_str(arg_fibex_conf.as_str());

            match (socket_conf, fibex_conf, filter_conf) {
                (Ok(socket_conf), Ok(fibex_conf), Ok(filter_conf)) => {
                    let shutdown_channel = sync::mpsc::channel(1);
                    let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();
                    let mut emitter = SocketDltEventEmitter {
                        event_receiver: rx,
                        shutdown_sender: shutdown_channel.0,
                        task_thread: None,
                    };

                    emitter.start_indexing_socket_in_thread(
                        session_id,
                        shutdown_channel.1,
                        tx,
                        SocketThreadConfig {
                            out_path,
                            tag,
                        },
                        socket_conf,
                        Some(filter_conf),
                        fibex_conf,
                    );
                    Ok(emitter)
                },
                _ => cx.throw_error("The socket/filter/fibex config was not valid"),
            }
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
            use tokio::runtime::Runtime;
            trace!("shutdown called");
            let this = cx.this();
            // Create the runtime
            let rt = Runtime::new().expect("Could not create runtime");

            // Unwrap the shutdown channel and send a shutdown command
            cx.borrow(&this, |emitter| {
                rt.block_on(
                    async {
                        let _ = emitter.shutdown_sender.send(()).await;
                        trace!("sent command Shutdown")
                    }
                );
            });
            Ok(JsUndefined::new().upcast())
        }
    }
}
