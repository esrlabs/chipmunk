use crate::channels::EventEmitterTask;
use crossbeam_channel as cc;
use indexer_base::progress::{IndexingProgress, IndexingResults};
use neon::prelude::*;
use processor::parse::{check_format, FormatCheckFlags, FormatCheckResult};
use std::{
    sync::{Arc, Mutex},
    thread,
};

type FormatResult = IndexingResults<FormatCheckResult>;
pub struct FormatVerifyEmitter {
    pub event_receiver: Arc<Mutex<cc::Receiver<FormatResult>>>,
    pub shutdown_sender: cc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl FormatVerifyEmitter {
    pub fn start_format_verification_in_thread(
        self: &mut FormatVerifyEmitter,
        format_string: String,
        flags: FormatCheckFlags,
        result_sender: cc::Sender<FormatResult>,
        shutdown_rx: cc::Receiver<()>,
    ) {
        self.task_thread = Some(thread::spawn(move || {
            verify_format_with_progress(format_string, flags, result_sender, Some(shutdown_rx));
            debug!("back format verification finished!",);
        }));
    }
}

fn verify_format_with_progress(
    format_string: String,
    flags: FormatCheckFlags,
    tx: cc::Sender<FormatResult>,
    _shutdown_receiver: Option<cc::Receiver<()>>,
) {
    trace!("verify format");
    let res = check_format(&format_string, flags);
    match tx.send(Ok(IndexingProgress::GotItem { item: res })) {
        Ok(()) => (),
        Err(_) => warn!("could not communicate errors to js"),
    }
    let _ = tx.send(Ok(IndexingProgress::Finished));
}
// interface of the Rust code for js, exposes the `poll` and `shutdown` methods
declare_types! {
pub class JsFormatVerificationEmitter for FormatVerifyEmitter {
    init(mut cx) {
        trace!("-> JsFormatVerificationEmitter");
        let format_string = cx.argument::<JsString>(0)?.value();
        let mut miss_day: bool = false;
        let mut miss_month: bool = false;
        let mut miss_year: bool = false;
        let miss_day_handle: Handle<JsValue> = cx.argument::<JsObject>(1)?.get(&mut cx, "miss_day")?;
        let miss_month_handle: Handle<JsValue> = cx.argument::<JsObject>(1)?.get(&mut cx, "miss_month")?;
        let miss_year_handle: Handle<JsValue> = cx.argument::<JsObject>(1)?.get(&mut cx, "miss_year")?;
        if miss_day_handle.is_a::<JsBoolean>() {
            miss_day = miss_day_handle
                .downcast::<JsBoolean>()
                .or_throw(&mut cx)?
                .value();
        }
        if miss_month_handle.is_a::<JsBoolean>() {
            miss_month = miss_month_handle
                .downcast::<JsBoolean>()
                .or_throw(&mut cx)?
                .value();
        }
        if miss_year_handle.is_a::<JsBoolean>() {
            miss_year = miss_year_handle
                .downcast::<JsBoolean>()
                .or_throw(&mut cx)?
                .value();
        }
        let flags: FormatCheckFlags = FormatCheckFlags {
            miss_day,
            miss_month,
            miss_year,
        };
        trace!("{:?}", format_string);
        let chunk_result_channel: (cc::Sender<FormatResult>, cc::Receiver<FormatResult>) = cc::unbounded();
        let shutdown_channel = cc::unbounded();
        let mut emitter = FormatVerifyEmitter {
            event_receiver: Arc::new(Mutex::new(chunk_result_channel.1)),
            shutdown_sender: shutdown_channel.0,
            task_thread: None,
        };
        emitter.start_format_verification_in_thread(
            format_string,
            flags,
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
