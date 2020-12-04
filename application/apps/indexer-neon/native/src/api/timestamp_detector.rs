use crate::channels::EventEmitterTask;
use crossbeam_channel as cc;
use indexer_base::progress::{IndexingResults, Notification, Severity};
use neon::prelude::*;
use processor::parse::{self, timespan_in_files, DiscoverItem, TimestampFormatResult};
use std::thread;

/// Trys to detect a valid timestamp in a string
/// Returns the a tuple of
/// * the timestamp as posix timestamp
/// * if the year was missing
///   (we assume the current year (local time) if true)
/// * the format string that was used
///
/// # Arguments
///
/// * `input` - A string slice that should be parsed
pub fn detect_timestamp_in_string(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let input: String = cx.argument::<JsString>(0)?.value();
    match parse::detect_timestamp_in_string(input.as_str(), None) {
        Ok((timestamp, _, _)) => Ok(cx.number((timestamp) as f64)),
        Err(e) => cx.throw_type_error(format!("{}", e)),
    }
}

pub struct TimestampDetectorEmitter {
    pub event_receiver: cc::Receiver<IndexingResults<TimestampFormatResult>>,
    pub shutdown_sender: cc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
    pub shutdown_rx: cc::Receiver<()>,
    pub result_sender: cc::Sender<IndexingResults<TimestampFormatResult>>,
}
impl TimestampDetectorEmitter {
    pub fn start_timespan_detection_in_thread(
        self: &mut TimestampDetectorEmitter,
        items: Vec<DiscoverItem>,
    ) {
        let shutdown_rx = self.shutdown_rx.clone();
        let result_sender = self.result_sender.clone();
        self.task_thread = Some(thread::spawn(move || {
            detect_timespan_with_progress(items, result_sender, Some(shutdown_rx));
            debug!("back after timespan detection finished!",);
        }));
    }
}

fn detect_timespan_with_progress(
    items: Vec<DiscoverItem>,
    tx: cc::Sender<IndexingResults<TimestampFormatResult>>,
    _shutdown_receiver: Option<cc::Receiver<()>>,
) {
    trace!("detecting timespan");
    match timespan_in_files(items, &tx) {
        Err(why) => {
            let err_msg = format!("couldn't detect timestamps: {}", why);
            error!("{}", err_msg);
            match tx.send(Err(Notification {
                severity: Severity::ERROR,
                content: err_msg,
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
pub class JsTimestampFormatDetectionEmitter for TimestampDetectorEmitter {
    init(_cx) {
        let chunk_result_channel: (cc::Sender<IndexingResults<TimestampFormatResult>>, cc::Receiver<IndexingResults<TimestampFormatResult>>) = cc::unbounded();
        let shutdown_channel = cc::unbounded();
        let emitter = TimestampDetectorEmitter {
            event_receiver: chunk_result_channel.1,
            shutdown_sender: shutdown_channel.0,
            task_thread: None,
            shutdown_rx: shutdown_channel.1,
            result_sender: chunk_result_channel.0,
        };
        Ok(emitter)
    }

    method start(mut cx) {
        let arg = cx.argument::<JsString>(0)?.value();
        let file_names = arg.as_str();
        let items: Result<Vec<DiscoverItem>, serde_json::Error> = serde_json::from_str(file_names);
        match items {
            Ok(items) => {
                let mut this = cx.this();
                cx.borrow_mut(&mut this, |mut detector| {
                    detector.start_timespan_detection_in_thread(
                        items,
                    );
                });
                Ok(JsUndefined::new().upcast())
            }
            Err(e) => cx.throw_error("The discover-items argument was not valid"),
        }
    }

    method poll(mut cx) {
        let cb = cx.argument::<JsFunction>(0)?;
        let this = cx.this();
         cx.borrow(&this, |emitter| {
            let task = EventEmitterTask::new(emitter.event_receiver.clone());
            task.schedule(cb);
        });
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
