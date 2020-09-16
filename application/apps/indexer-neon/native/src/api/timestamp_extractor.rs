use crate::channels::EventEmitterTask;
use crossbeam_channel as cc;
use indexer_base::progress::{IndexingProgress, IndexingResults};
use neon::prelude::*;
use processor::parse::{
    extract_posix_timestamp_by_format, DateTimeReplacements, TimestampByFormatResult,
};
use std::thread;

type ExtractResult = IndexingResults<TimestampByFormatResult>;

pub struct TimestampExtractEmitter {
    pub event_receiver: cc::Receiver<ExtractResult>,
    pub shutdown_sender: cc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}

impl TimestampExtractEmitter {
    pub fn start_extracting_timestamp_in_thread(
        self: &mut TimestampExtractEmitter,
        input_string: String,
        format_string: String,
        replacements: DateTimeReplacements,
        result_sender: cc::Sender<ExtractResult>,
        shutdown_rx: cc::Receiver<()>,
    ) {
        self.task_thread = Some(thread::spawn(move || {
            extract_timestamp_with_progress(
                input_string,
                format_string,
                replacements,
                result_sender,
                Some(shutdown_rx),
            );
            debug!("back format verification finished!",);
        }));
    }
}

fn extract_timestamp_with_progress(
    input_string: String,
    format_string: String,
    replacements: DateTimeReplacements,
    tx: cc::Sender<ExtractResult>,
    _shutdown_receiver: Option<cc::Receiver<()>>,
) {
    trace!("extracting timestamp");
    let res = extract_posix_timestamp_by_format(&input_string, &format_string, replacements);
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
        let replacements_handle_day: Handle<JsValue> = cx.argument::<JsObject>(2)?.get(&mut cx, "day")?;
        let replacements_handle_month: Handle<JsValue> = cx.argument::<JsObject>(2)?.get(&mut cx, "month")?;
        let replacements_handle_year: Handle<JsValue> = cx.argument::<JsObject>(2)?.get(&mut cx, "year")?;
        let replacements_handle_offset: Handle<JsValue> = cx.argument::<JsObject>(2)?.get(&mut cx, "offset")?;
        let mut replacements: DateTimeReplacements = DateTimeReplacements {
            day: None,
            month: None,
            year: None,
            offset: Some(0),
        };
        if replacements_handle_day.is_a::<JsNumber>() {
            replacements.day = Some(replacements_handle_day
                .downcast::<JsNumber>()
                .or_throw(&mut cx)?
                .value() as u32);
        }
        if replacements_handle_month.is_a::<JsNumber>() {
            replacements.month = Some(replacements_handle_month
                .downcast::<JsNumber>()
                .or_throw(&mut cx)?
                .value() as u32);
        }
        if replacements_handle_year.is_a::<JsNumber>() {
            replacements.year = Some(replacements_handle_year
                .downcast::<JsNumber>()
                .or_throw(&mut cx)?
                .value() as i32);
        }
        if replacements_handle_offset.is_a::<JsNumber>() {
            replacements.offset = Some(replacements_handle_offset
                .downcast::<JsNumber>()
                .or_throw(&mut cx)?
                .value() as i64);
        }
        trace!("{:?}/{:?}", input_string, format_string);
        let chunk_result_channel: (cc::Sender<ExtractResult>, cc::Receiver<ExtractResult>) = cc::unbounded();
        let shutdown_channel = cc::unbounded();
        let mut emitter = TimestampExtractEmitter {
            event_receiver: chunk_result_channel.1,
            shutdown_sender: shutdown_channel.0,
            task_thread: None,
        };
        emitter.start_extracting_timestamp_in_thread(
            input_string,
            format_string,
            replacements,
            chunk_result_channel.0,
            shutdown_channel.1,
        );
        Ok(emitter)
    }

    method poll(mut cx) {
        let cb = cx.argument::<JsFunction>(0)?;
        let this = cx.this();
        let events = cx.borrow(&this, |emitter| emitter.event_receiver.clone());
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
