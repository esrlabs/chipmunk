use channels::EventEmitterTask;
use indexer_base::progress::Notification;
use indexer_base::progress::{IndexingProgress, IndexingResults, Severity};
use merging::concatenator::{concat_files, ConcatenatorInput, ConcatenatorResult};
use neon::prelude::*;
use std::path;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

pub type ConcatenatedLinesResults =
    std::result::Result<IndexingProgress<ConcatenatorResult>, Notification>;
pub struct ConcatenatorEmitter {
    pub event_receiver: Arc<Mutex<mpsc::Receiver<ConcatenatedLinesResults>>>,
    pub shutdown_sender: mpsc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}

impl ConcatenatorEmitter {
    pub fn start_concatenation_in_thread(
        self: &mut ConcatenatorEmitter,
        concat_inputs: Vec<ConcatenatorInput>,
        out_path: path::PathBuf,
        append: bool,
        update_channel: mpsc::Sender<ConcatenatedLinesResults>,
        shutdown_rx: mpsc::Receiver<()>,
    ) {
        self.task_thread = Some(thread::spawn(move || {
            conatenate_with_progress(
                concat_inputs,
                out_path,
                append,
                update_channel,
                Some(shutdown_rx),
            );
            debug!("back after concatenation finished!",);
        }));
    }
}

fn conatenate_with_progress(
    concat_inputs: Vec<ConcatenatorInput>,
    out_path: path::PathBuf,
    append: bool,
    update_channel: mpsc::Sender<ConcatenatedLinesResults>,
    shutdown_receiver: Option<mpsc::Receiver<()>>,
) {
    trace!(
        "conatenate_with_progress with {} files <------------",
        concat_inputs.len()
    );

    match concat_files(
        concat_inputs,
        &out_path,
        append,
        update_channel.clone(),
        shutdown_receiver,
    ) {
        Err(why) => {
            let err_msg = format!("couldn't conatenate_with_progress: {}", why);
            error!("{}", err_msg);
            match update_channel.send(Err(Notification {
                severity: Severity::ERROR,
                content: err_msg,
                line: None,
            })) {
                Ok(()) => (),
                Err(_) => warn!("could not communicate errors to js"),
            }
            let _ = update_channel.send(Ok(IndexingProgress::Stopped));
        }
        Ok(()) => trace!("concatenation done"),
    }
}
// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {

    pub class JsConcatenatorEmitter for ConcatenatorEmitter {
        init(mut cx) {
            let arg_concat_inputs = cx.argument::<JsValue>(0)?;
            let concat_inputs: Vec<ConcatenatorInput> = neon_serde::from_value(&mut cx, arg_concat_inputs)?;
            let out_path = path::PathBuf::from(cx.argument::<JsString>(1)?.value().as_str());
            let append: bool = cx.argument::<JsBoolean>(2)?.value();
            trace!("out_path: {:?}", out_path);
            trace!("append: {:?}", append);

            let chunk_result_channel: (Sender<IndexingResults<ConcatenatorResult>>, Receiver<IndexingResults<ConcatenatorResult>>) = mpsc::channel();
            let shutdown_channel = mpsc::channel();
            let mut emitter = ConcatenatorEmitter{
                event_receiver: Arc::new(Mutex::new(chunk_result_channel.1)),
                shutdown_sender: shutdown_channel.0,
                task_thread: None,
            };
            emitter.start_concatenation_in_thread(
                concat_inputs,
                out_path,
                append,
                chunk_result_channel.0,
                shutdown_channel.1,
            );
            Ok(emitter)
        }

        method poll(mut cx) {
            let cb = cx.argument::<JsFunction>(0)?;
            let this = cx.this();
            let events = cx.borrow(&this, |emitter| Arc::clone(&emitter.event_receiver));
            let emitter = EventEmitterTask::new(events);
            emitter.schedule(cb);
            Ok(JsUndefined::new().upcast())
        }

        method shutdown(mut cx) {
            trace!("shutdown called");
            let this = cx.this();
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
