use crate::channels::EventEmitterTask;
use crossbeam_channel as cc;
use indexer_base::progress::{IndexingProgress, IndexingResults};
use neon::prelude::*;
use processor::parse::{extract_posix_timestamp_by_format, TimestampByFormatResult};
use std::sync::{Arc, Mutex};
use std::thread;

type ExtractResult = IndexingResults<TimestampByFormatResult>;

pub struct TimestampExtractEmitter {
    pub event_receiver: Arc<Mutex<cc::Receiver<ExtractResult>>>,
    pub shutdown_sender: cc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}

impl TimestampExtractEmitter {
    pub fn start_extracting_timestamp_in_thread(
        self: &mut TimestampExtractEmitter,
        input_string: String,
        format_string: String,
        result_sender: cc::Sender<ExtractResult>,
        shutdown_rx: cc::Receiver<()>,
    ) {
        self.task_thread = Some(thread::spawn(move || {
            extract_timestamp_with_progress(input_string, format_string, result_sender, Some(shutdown_rx));
            debug!("back format verification finished!",);
        }));
    }
}

fn extract_timestamp_with_progress(
    input_string: String,
    format_string: String,
    tx: cc::Sender<ExtractResult>,
    _shutdown_receiver: Option<cc::Receiver<()>>,
) {
    trace!("extracting timestamp");
    let res = extract_posix_timestamp_by_format(&input_string, &format_string, None, Some(0));
    match tx.send(Ok(IndexingProgress::GotItem { item: res })) {
        Ok(()) => (),
        Err(_) => warn!("could not communicate errors to js"),
    }
    let _ = tx.send(Ok(IndexingProgress::Finished));
}

// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {
pub class JsTimestampExtractEmitter for TimestampExtractEmitter {
    init(mut cx) {
        trace!("-> JsTimestampExtractEmitter");
        let input_string = cx.argument::<JsString>(0)?.value();
        let format_string = cx.argument::<JsString>(1)?.value();
        trace!("{:?}/{:?}", input_string, format_string);
        let chunk_result_channel: (cc::Sender<ExtractResult>, cc::Receiver<ExtractResult>) = cc::unbounded();
        let shutdown_channel = cc::unbounded();
        let mut emitter = TimestampExtractEmitter {
            event_receiver: Arc::new(Mutex::new(chunk_result_channel.1)),
            shutdown_sender: shutdown_channel.0,
            task_thread: None,
        };
        emitter.start_extracting_timestamp_in_thread(
            input_string,
            format_string,
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
