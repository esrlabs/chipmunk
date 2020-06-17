use crate::channels::EventEmitterTask;
use crossbeam_channel as cc;
use indexer_base::progress::{IndexingResults, Notification, Severity};
use neon::prelude::*;
use processor::parse::{timespan_in_files, DiscoverItem, TimestampFormatResult};
use std::{
    sync::{Arc, Mutex},
    thread,
};

pub struct TimestampDetectorEmitter {
    pub event_receiver: Arc<Mutex<cc::Receiver<IndexingResults<TimestampFormatResult>>>>,
    pub shutdown_sender: cc::Sender<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl TimestampDetectorEmitter {
    pub fn start_timespan_detection_in_thread(
        self: &mut TimestampDetectorEmitter,
        items: Vec<DiscoverItem>,
        result_sender: cc::Sender<IndexingResults<TimestampFormatResult>>,
        shutdown_rx: cc::Receiver<()>,
    ) {
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
    match timespan_in_files(
        items, &tx,
        // shutdown_receiver,
    ) {
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
    init(mut cx) {
        let file_names = cx.argument::<JsValue>(0)?;
        let items: Vec<DiscoverItem> = neon_serde::from_value(&mut cx, file_names)?;
        trace!("{:?}", items);
        let chunk_result_channel: (cc::Sender<IndexingResults<TimestampFormatResult>>, cc::Receiver<IndexingResults<TimestampFormatResult>>) = cc::unbounded();
        let shutdown_channel = cc::unbounded();
        let mut emitter = TimestampDetectorEmitter {
            event_receiver: Arc::new(Mutex::new(chunk_result_channel.1)),
            shutdown_sender: shutdown_channel.0,
            task_thread: None,
        };
        emitter.start_timespan_detection_in_thread(
            items,
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
