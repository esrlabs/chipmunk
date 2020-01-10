use crate::channels::EventEmitterTask;
use crossbeam_channel as cc;
use dlt::dlt_parse::StatisticsResults;
use indexer_base::progress::{Notification, Severity};
use neon::prelude::*;
use std::path;
use std::sync::{Arc, Mutex};
use std::thread;

pub struct DltStatsEventEmitter {
    pub event_receiver: Arc<Mutex<cc::Receiver<StatisticsResults>>>,
    pub shutdown_sender: cc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl DltStatsEventEmitter {
    pub fn start_dlt_stats_in_thread(
        self: &mut DltStatsEventEmitter,
        source_file: path::PathBuf,
        shutdown_rx: cc::Receiver<()>,
        chunk_result_sender: cc::Sender<StatisticsResults>,
    ) {
        // Spawn a thead to continue running after this method has returned.
        self.task_thread = Some(thread::spawn(move || {
            dlt_stats_with_progress(source_file, chunk_result_sender.clone(), Some(shutdown_rx));
            debug!("back after indexing finished!",);
        }));
    }
}

fn dlt_stats_with_progress(
    source_file: path::PathBuf,
    tx: cc::Sender<StatisticsResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
) {
    trace!("calling dlt stats with progress");
    match dlt::dlt_parse::get_dlt_file_info(&source_file, &tx, shutdown_receiver) {
        Err(why) => {
            error!("couldn't collect statistics: {}", why);
            match tx.send(Err(Notification {
                severity: Severity::ERROR,
                content: format!("couldn't collect statistics: {}", why),
                line: None,
            })) {
                Ok(()) => (),
                Err(_) => warn!("could not communicate errors to js"),
            }
        }
        Ok(_) => trace!("get_dlt_file_info returned ok"),
    }
}

// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {
    pub class JsDltStatsEventEmitter for DltStatsEventEmitter {
        init(mut cx) {
            trace!("Rust: JsDltStatsEventEmitter");
            let file_name = cx.argument::<JsString>(0)?.value();
            let file_path = path::PathBuf::from(file_name);
            let chunk_result_channel: (cc::Sender<StatisticsResults>, cc::Receiver<StatisticsResults>) = cc::unbounded();
            let shutdown_channel = cc::unbounded();
            let mut emitter = DltStatsEventEmitter {
                event_receiver: Arc::new(Mutex::new(chunk_result_channel.1)),
                shutdown_sender: shutdown_channel.0,
                task_thread: None,
            };
            emitter.start_dlt_stats_in_thread(
                file_path,
                shutdown_channel.1,
                chunk_result_channel.0
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
