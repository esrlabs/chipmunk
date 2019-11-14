use channels::EventEmitterTask;
use indexer_base::chunks::ChunkResults;
use indexer_base::progress::Notification;
use indexer_base::progress::{IndexingProgress, Severity};
use merging::merger::merge_files_iter;
use merging::merger::MergeItemOptions;
use merging::merger::MergerInput;
use neon::prelude::*;
use std::path;
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

pub struct MergerEmitter {
    pub event_receiver: Arc<Mutex<mpsc::Receiver<ChunkResults>>>,
    pub shutdown_sender: mpsc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}

impl MergerEmitter {
    pub fn start_merging_in_thread(
        self: &mut MergerEmitter,
        merge_inputs: Vec<MergerInput>,
        out_path: path::PathBuf,
        append: bool,
        chunk_size: usize,
        update_channel: mpsc::Sender<ChunkResults>,
        shutdown_rx: mpsc::Receiver<()>,
    ) {
        self.task_thread = Some(thread::spawn(move || {
            merge_with_progress(
                merge_inputs,
                out_path,
                append,
                chunk_size,
                update_channel,
                Some(shutdown_rx),
            );
            debug!("back after merging finished!",);
        }));
    }
}

fn merge_with_progress(
    merge_inputs: Vec<MergerInput>,
    out_path: path::PathBuf,
    append: bool,
    chunk_size: usize, // used for mapping line numbers to byte positions
    update_channel: mpsc::Sender<ChunkResults>,
    shutdown_receiver: Option<mpsc::Receiver<()>>,
) {
    trace!(
        "merge_with_progress with {} files <------------",
        merge_inputs.len()
    );

    match merge_files_iter(
        append,
        merge_inputs,
        &out_path,
        chunk_size,
        update_channel.clone(),
        shutdown_receiver,
    ) {
        Err(why) => {
            let err_msg = format!("couldn't merge_with_progress: {}", why);
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
        Ok(()) => trace!("merge done"),
    }
}

// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {

pub class JsMergerEmitter for MergerEmitter {
    init(mut cx) {
        let arg_merge_inputs = cx.argument::<JsValue>(0)?;
        let merge_item_options: Vec<MergeItemOptions> = neon_serde::from_value(&mut cx, arg_merge_inputs)?;
        let out_path = path::PathBuf::from(cx.argument::<JsString>(1)?.value().as_str());
        let append: bool = cx.argument::<JsBoolean>(2)?.value();
        let chunk_size: usize = cx.argument::<JsNumber>(3)?.value() as usize;
        trace!("merge inputs: {:?}", merge_item_options);
        trace!("out_path: {:?}", out_path);
        trace!("append: {:?}", append);

        let (result_tx, result_rx): (Sender<ChunkResults>, Receiver<ChunkResults>) = mpsc::channel();
        let shutdown_channel = mpsc::channel();
        let mut emitter = MergerEmitter{
            event_receiver: Arc::new(Mutex::new(result_rx)),
            shutdown_sender: shutdown_channel.0,
            task_thread: None,
        };
        let merge_inputs = merge_item_options.into_iter().map(|i: merging::merger::MergeItemOptions| {
            MergerInput {
                path: std::path::PathBuf::from(i.name),
                offset: i.offset,
                year: i.year,
                tag: i.tag,
                format: i.format,
            }
        }).collect();
        emitter.start_merging_in_thread(
            merge_inputs,
            out_path,
            append,
            chunk_size,
            result_tx,
            shutdown_channel.1,
        );
        Ok(emitter)
    }

    method poll(mut cx) {
        let cb = cx.argument::<JsFunction>(0)?;
        let this = cx.this();
        let events = cx.borrow(&this, |emitter| Arc::clone(&emitter.event_receiver));
        let emitter_task = EventEmitterTask::new(events);
        emitter_task.schedule(cb);
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
