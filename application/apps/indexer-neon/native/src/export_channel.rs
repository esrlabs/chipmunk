use crate::channels::EventEmitterTask;
use anyhow::{Error, *};
use crossbeam_channel as cc;
use indexer_base::{chunks::ChunkResults, config::SectionConfig, export::export_file_line_based};
use neon::context::Context;
use neon::prelude::*;
use std::{
    path,
    sync::{Arc, Mutex},
    thread,
};

static DLT_SESSION_ID: &str = "session";
static DLT_SOURCE_FILE: &str = "file";
static LINE_BASED_SOURCE_FILE: &str = "lines";

pub struct ExporterEventEmitter {
    pub event_receiver: Arc<Mutex<cc::Receiver<ChunkResults>>>,
    pub shutdown_sender: async_std::sync::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl ExporterEventEmitter {
    #[allow(clippy::too_many_arguments)]
    pub fn start_exporting_file_in_thread(
        self: &mut Self,
        source: String,
        source_type: String,
        destination_path: path::PathBuf,
        sections_config: SectionConfig,
        was_session_file: bool,
        // TODO react on shutdown event
        _shutdown_rx: async_std::sync::Receiver<()>,
        chunk_result_sender: cc::Sender<ChunkResults>,
    ) -> Result<(), Error> {
        info!(
            "start_exporting_file_in_thread (source type {}): {:?}",
            source_type, sections_config
        );

        // Spawn a thread to continue running after this method has returned.
        if source_type == DLT_SESSION_ID {
            let session_id = source;

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
            Ok(())
        } else if source_type == DLT_SOURCE_FILE {
            let dlt_file_path = path::PathBuf::from(source);

            self.task_thread = Some(thread::spawn(move || {
                match dlt::dlt_file::export_as_dlt_file(
                    dlt_file_path,
                    destination_path,
                    sections_config,
                    chunk_result_sender,
                ) {
                    Ok(_) => {}
                    Err(e) => warn!("error exporting dlt messages: {}", e),
                }
                debug!("back after DLT export finished!");
            }));
            Ok(())
        } else if source_type == LINE_BASED_SOURCE_FILE {
            let file_path = path::PathBuf::from(source);

            self.task_thread = Some(thread::spawn(move || {
                match export_file_line_based(
                    file_path,
                    destination_path,
                    sections_config,
                    was_session_file,
                    chunk_result_sender,
                ) {
                    Ok(_) => {}
                    Err(e) => warn!("error exporting lines: {}", e),
                }
                debug!("back after line export finished!");
            }));
            Ok(())
        } else {
            Err(anyhow!("unknown source type: {}", source_type))
        }
    }
}

// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {
    pub class JsExporterEventEmitter for ExporterEventEmitter {
        init(mut cx) {
            trace!("Rust: JsExporterEventEmitter");
            let mut i = 0i32;
            let source = cx.argument::<JsString>(i)?.value();
            i += 1;
            let source_type = cx.argument::<JsString>(i)?.value();
            i += 1;
            let destination_path = path::PathBuf::from(cx.argument::<JsString>(i)?.value().as_str());
            i += 1;
            let arg_sections_conf = cx.argument::<JsValue>(i)?;
            let sections_conf: SectionConfig = neon_serde::from_value(&mut cx, arg_sections_conf)?;
            i += 1;
            let was_session_file = cx.argument::<JsBoolean>(i)?.value();

            let shutdown_channel = async_std::sync::channel(1);
            let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();
            let mut emitter = ExporterEventEmitter {
                event_receiver: Arc::new(Mutex::new(rx)),
                shutdown_sender: shutdown_channel.0,
                task_thread: None,
            };

            match emitter.start_exporting_file_in_thread(
                source,
                source_type,
                destination_path,
                sections_conf,
                was_session_file,
                shutdown_channel.1,
                tx,
            ) {
                Ok(()) => Ok(emitter),
                Err(_) => Err(neon::result::Throw)
            }
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
