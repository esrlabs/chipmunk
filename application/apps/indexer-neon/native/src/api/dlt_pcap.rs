use crate::{
    channels::EventEmitterTask, config::IndexingThreadConfig, fibex_utils::gather_fibex_data,
};
use crossbeam_channel as cc;
use dlt::{fibex::FibexMetadata, filtering};
use indexer_base::{
    chunks::ChunkResults,
    config::{FibexConfig, IndexingConfig},
};
use neon::prelude::*;
use std::{path, thread};
use tokio::sync;

pub struct PcapDltEventEmitter {
    pub event_receiver: cc::Receiver<ChunkResults>,
    pub shutdown_sender: sync::mpsc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl PcapDltEventEmitter {
    #[allow(clippy::too_many_arguments)]
    pub fn start_indexing_pcap_file_in_thread(
        &mut self,
        chunk_size: usize,
        shutdown_rx: sync::mpsc::Receiver<()>,
        chunk_result_sender: cc::Sender<ChunkResults>,
        thread_conf: IndexingThreadConfig,
        filter_conf: Option<filtering::DltFilterConfig>,
        fibex: FibexConfig,
    ) {
        info!("start_indexing_pcap_file_in_thread: {:?}", thread_conf);

        // Spawn a thread to continue running after this method has returned.
        self.task_thread = Some(thread::spawn(move || {
            let fibex_metadata: Option<FibexMetadata> = gather_fibex_data(fibex);
            match dlt::dlt_pcap::create_index_and_mapping_dlt_from_pcap(
                IndexingConfig {
                    tag: thread_conf.tag,
                    chunk_size,
                    in_file: thread_conf.in_file,
                    out_path: thread_conf.out_path,
                    append: thread_conf.append,
                    watch: false,
                },
                filter_conf,
                &chunk_result_sender,
                shutdown_rx,
                fibex_metadata.map(std::rc::Rc::new),
            ) {
                Ok(_) => {}
                Err(e) => warn!("error for pcap dlt stream: {}", e),
            }
            debug!("back after DLT pcap indexing finished!");
        }));
    }
}

// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {
    pub class JsDltPcapEventEmitter for PcapDltEventEmitter {
        init(mut cx) {
            trace!("Rust: JsDltPcapEventEmitter");
            let file = cx.argument::<JsString>(0)?.value();
            let tag = cx.argument::<JsString>(1)?.value();
            let out_path = path::PathBuf::from(cx.argument::<JsString>(2)?.value().as_str());
            let chunk_size: usize = cx.argument::<JsNumber>(3)?.value() as usize;
            let arg_filter_conf = cx.argument::<JsString>(4)?.value();
            let filter_conf: Result<dlt::filtering::DltFilterConfig, serde_json::Error> =
                serde_json::from_str(arg_filter_conf.as_str());
            let append: bool = cx.argument::<JsBoolean>(5)?.value();

            let arg_fibex_conf = cx.argument::<JsString>(6)?.value();
            let fibex_conf: Result<FibexConfig, serde_json::Error> = serde_json::from_str(arg_fibex_conf.as_str());

            match (filter_conf, fibex_conf) {
                (Ok(filter_conf), Ok(fibex_conf)) => {
                    let shutdown_channel = sync::mpsc::channel(1);
                    let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();
                    let mut emitter = PcapDltEventEmitter {
                        event_receiver: rx,
                        shutdown_sender: shutdown_channel.0,
                        task_thread: None,
                    };
                    let file_path = path::PathBuf::from(&file);

                    emitter.start_indexing_pcap_file_in_thread(
                        chunk_size,
                        shutdown_channel.1,
                        tx,
                        IndexingThreadConfig {
                            in_file: file_path,
                            out_path,
                            append,
                            tag,
                            timestamps: false,
                        },
                        Some(filter_conf),
                        fibex_conf,
                    );
                    Ok(emitter)
                }
                _ => cx.throw_error("The filter or fibex config was not valid"),
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
