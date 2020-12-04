use crate::channels::EventEmitterTask;
use crossbeam_channel as cc;
use indexer_base::{
    chunks::ChunkResults,
    progress::{IndexingProgress, Notification, Severity},
};
use merging::merger::{merge_files_use_config, FileMergeOptions};
use neon::prelude::*;
use std::{
    path::{Path, PathBuf},
    thread,
};

pub struct MergerEmitter {
    pub event_receiver: cc::Receiver<ChunkResults>,
    pub shutdown_sender: cc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}

impl MergerEmitter {
    pub fn start_merging_in_thread(
        self: &mut MergerEmitter,
        options: Vec<FileMergeOptions>,
        out_path: &Path,
        append: bool,
        chunk_size: usize, // used for mapping line numbers to byte positions
        update_channel: cc::Sender<ChunkResults>,
        shutdown_rx: cc::Receiver<()>,
    ) {
        let out = PathBuf::from(out_path);

        self.task_thread = Some(thread::spawn(move || {
            merge_with_progress(
                options,
                &out,
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
    options: Vec<FileMergeOptions>,
    out_path: &Path,
    append: bool,
    chunk_size: usize, // used for mapping line numbers to byte positions
    update_channel: cc::Sender<ChunkResults>,
    shutdown_receiver: Option<cc::Receiver<()>>,
) {
    match merge_files_use_config(
        options,
        out_path,
        append,
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
        let arg_merge_inputs = cx.argument::<JsString>(0)?.value();
        let merge_item_options: Result<Vec<FileMergeOptions>, serde_json::Error> =
            serde_json::from_str(arg_merge_inputs.as_str());
        let out_path = PathBuf::from(cx.argument::<JsString>(1)?.value().as_str());
        let append: bool = cx.argument::<JsBoolean>(2)?.value();
        let chunk_size: usize = cx.argument::<JsNumber>(3)?.value() as usize;
        trace!("merge inputs: {:?}", merge_item_options);
        trace!("out_path: {:?}", out_path);
        trace!("append: {:?}", append);
        match merge_item_options {
            Ok(merge_item_options) => {
                let (result_tx, result_rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();
                let shutdown_channel = cc::unbounded();
                let mut emitter = MergerEmitter{
                    event_receiver: result_rx,
                    shutdown_sender: shutdown_channel.0,
                    task_thread: None,
                };
                emitter.start_merging_in_thread(
                    merge_item_options,
                    &out_path,
                    append,
                    chunk_size,
                    result_tx,
                    shutdown_channel.1,
                );
                Ok(emitter)
            }
            Err(e) => cx.throw_error("The merge-configuration was not valid"),
        }

    }

    method poll(mut cx) {
        let cb = cx.argument::<JsFunction>(0)?;
        let this = cx.this();
        let events = cx.borrow(&this, |emitter| emitter.event_receiver.clone());
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
