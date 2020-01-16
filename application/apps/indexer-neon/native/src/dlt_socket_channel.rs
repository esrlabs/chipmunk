use crate::channels::EventEmitterTask;
use crate::channels::SocketThreadConfig;
use crossbeam_channel as cc;
use dlt::fibex::FibexMetadata;
use dlt::filtering;
use indexer_base::chunks::ChunkResults;
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
        fibex: Option<String>,
    ) {
        info!("start_indexing_socket_in_thread: {:?}", thread_conf);

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
            index_from_socket(
                socket_conf,
                filter_conf,
                chunk_result_sender.clone(),
                fibex_metadata,
                thread_conf.append,
                thread_conf.tag.as_str(),
                thread_conf.ecu_id,
                &thread_conf.out_path,
                shutdown_rx,
            );
            debug!("back after DLT indexing finished!");
        }));
    }
}

#[allow(clippy::too_many_arguments)]
fn index_from_socket(
    socket_conf: SocketConfig,
    filter_conf: Option<filtering::DltFilterConfig>,
    update_channel: cc::Sender<ChunkResults>,
    fibex_metadata: Option<Rc<FibexMetadata>>,
    append: bool,
    tag: &str,
    ecu_id: String,
    out_path: &std::path::PathBuf,
    shutdown_receiver: async_std::sync::Receiver<()>,
) {
    trace!("index_from_socket");
    match dlt::dlt_parse::create_index_and_mapping_dlt_from_socket(
        socket_conf,
        append,
        tag,
        ecu_id,
        out_path,
        filter_conf,
        &update_channel,
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
    pub class JsDltSocketEventEmitter for SocketDltEventEmitter {
        init(mut cx) {
            trace!("Rust: JsDltSocketEventEmitter");
            let ecu_id = cx.argument::<JsString>(0)?.value();
            let arg_socket_conf = cx.argument::<JsValue>(1)?;
            let socket_conf: SocketConfig = neon_serde::from_value(&mut cx, arg_socket_conf)?;
            let tag = cx.argument::<JsString>(2)?.value();
            let out_path = path::PathBuf::from(cx.argument::<JsString>(3)?.value().as_str());
            let append: bool = cx.argument::<JsBoolean>(4)?.value();
            let arg_filter_conf = cx.argument::<JsValue>(5)?;
            let filter_conf: dlt::filtering::DltFilterConfig = neon_serde::from_value(&mut cx, arg_filter_conf)?;
            let mut fibex: Option<String> = None;
            if let Some(arg) = cx.argument_opt(6) {
                if arg.is_a::<JsString>() {
                    fibex = Some(arg.downcast::<JsString>().or_throw(&mut cx)?.value());
                } else if arg.is_a::<JsUndefined>() {
                    trace!("fibex arg was not set");
                }
            }

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
                    append,
                    tag,
                    ecu_id,
                },
                socket_conf,
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
