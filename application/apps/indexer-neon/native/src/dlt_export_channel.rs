use crate::channels::EventEmitterTask;
use crossbeam_channel as cc;
use indexer_base::chunks::ChunkResults;
use indexer_base::config::SectionConfig;
use neon::prelude::*;
use std::path;
use std::sync::{Arc, Mutex};
use std::thread;

pub struct DltExporterEventEmitter {
    pub event_receiver: Arc<Mutex<cc::Receiver<ChunkResults>>>,
    pub shutdown_sender: async_std::sync::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl DltExporterEventEmitter {
    #[allow(clippy::too_many_arguments)]
    pub fn start_exporting_file_in_thread(
        self: &mut Self,
        session_id: String,
        destination_path: path::PathBuf,
        sections_config: SectionConfig,
        shutdown_rx: async_std::sync::Receiver<()>,
        chunk_result_sender: cc::Sender<ChunkResults>,
    ) {
        info!("start_exporting_file_in_thread: {:?}", sections_config);

        // Spawn a thread to continue running after this method has returned.
        self.task_thread = Some(thread::spawn(move || {
            match dlt::dlt_file::export_session_file(
                session_id,
                destination_path,
                sections_config,
                chunk_result_sender,
            ) {
                Ok(_) => {}
                Err(e) => warn!("error exporting dlt messages: {}", e),
            }
            debug!("back after DLT export finished!");
        }));
    }
}

// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {
    pub class JsDltExporterEventEmitter for DltExporterEventEmitter {
        init(mut cx) {
            trace!("Rust: JsDltExporterEventEmitter");
            let session_id = cx.argument::<JsString>(0)?.value();
            let destination_path = path::PathBuf::from(cx.argument::<JsString>(1)?.value().as_str());
            let arg_sections_conf = cx.argument::<JsValue>(2)?;
            let sections_conf: SectionConfig = neon_serde::from_value(&mut cx, arg_sections_conf)?;

            let shutdown_channel = async_std::sync::channel(1);
            let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();
            let mut emitter = DltExporterEventEmitter {
                event_receiver: Arc::new(Mutex::new(rx)),
                shutdown_sender: shutdown_channel.0,
                task_thread: None,
            };

            emitter.start_exporting_file_in_thread(
                session_id,
                destination_path,
                sections_conf,
                shutdown_channel.1,
                tx,
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
