use crate::channels::EventEmitterTask;
use indexer_base::chunks::VoidResults;

use crossbeam_channel as cc;
use neon::prelude::*;
use std::{path, thread};
use tokio::sync;

pub struct PcapDltConverterEventEmitter {
    pub event_receiver: cc::Receiver<VoidResults>,
    pub shutdown_sender: sync::mpsc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl PcapDltConverterEventEmitter {
    #[allow(clippy::too_many_arguments)]
    pub fn start_converting_to_dlt_in_thread(
        &mut self,
        shutdown_rx: sync::mpsc::Receiver<()>,
        chunk_result_sender: cc::Sender<VoidResults>,
        pcap_file_path: path::PathBuf,
        out_file_path: path::PathBuf,
    ) {
        info!("start_converting_to_dlt_in_thread");
        let dlt_filter_config = None;

        // Spawn a thread to continue running after this method has returned.
        self.task_thread = Some(thread::spawn(move || {
            match dlt::dlt_pcap::pcap_to_dlt(
                &pcap_file_path,
                &out_file_path,
                dlt_filter_config,
                chunk_result_sender,
                shutdown_rx,
                None,
            ) {
                Ok(_) => info!("Conversion was ok"),
                Err(e) => warn!("Conversion error: {}", e),
            }
            debug!("Back after DLT pcap indexing finished!");
        }));
    }
}

// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {
    pub class JsDltPcapConverterEventEmitter for PcapDltConverterEventEmitter {
        init(mut cx) {
            trace!("Rust: JsDltPcapConverterEventEmitter");

            let file_path = path::PathBuf::from(cx.argument::<JsString>(0)?.value().as_str());
            let out_path = path::PathBuf::from(cx.argument::<JsString>(1)?.value().as_str());

            let (shutdown_tx, shutdown_rx) = sync::mpsc::channel(1);
            let (tx, rx): (cc::Sender<VoidResults>, cc::Receiver<VoidResults>) = cc::unbounded();
            let mut emitter = PcapDltConverterEventEmitter {
                event_receiver: rx,
                shutdown_sender: shutdown_tx,
                task_thread: None,
            };

            emitter.start_converting_to_dlt_in_thread(
                shutdown_rx,
                tx,
                file_path,
                out_path,
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
            use tokio::runtime::Runtime;
            // Create the runtime
            let rt = Runtime::new().expect("Could not create runtime");

            // Unwrap the shutdown channel and send a shutdown command
            cx.borrow(&this, |emitter| {
                rt.block_on(
                    async {
                        let _ = emitter.shutdown_sender.clone().send(()).await;
                        trace!("sent command Shutdown")
                    }
                );
            });
            Ok(JsUndefined::new().upcast())
        }
    }
}
