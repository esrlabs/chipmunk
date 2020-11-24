use crossbeam_channel as cc;
use indexer_base::progress::{IndexingProgress, IndexingResults, Notification};
use neon::prelude::*;
use serde::Serialize;
use std::{fmt::Debug, time::Duration};

// Reading from a channel `Receiver` is a blocking operation. This struct
// wraps the data required to perform a read asynchronously from a libuv
// thread.
pub struct EventEmitterTask<T: Send + Debug + Serialize> {
    events_rx: cc::Receiver<IndexingResults<T>>,
}

impl<T: Send + Debug + Serialize> EventEmitterTask<T> {
    pub fn new(event_stream: cc::Receiver<IndexingResults<T>>) -> EventEmitterTask<T> {
        EventEmitterTask::<T> {
            events_rx: event_stream,
        }
    }
}
// Implementation of a neon `Task` for `EventEmitterTask`. This task reads
// from the events channel and calls a JS callback with the data.
impl<T: 'static + Send + Debug + Serialize> Task for EventEmitterTask<T> {
    type Output = Option<Result<IndexingProgress<T>, Notification>>;
    type Error = String;
    type JsEvent = JsValue;

    // The work performed on the `libuv` thread. First acquire a lock on
    // the receiving thread and then return the received data.
    // In practice, this should never need to wait for a lock since it
    // should only be executed one at a time by the `EventEmitter` class.
    fn perform(&self) -> Result<Self::Output, Self::Error> {
        // Attempt to read from the channel. Block for at most 100 ms.
        match self.events_rx.recv_timeout(Duration::from_millis(100)) {
            Ok(event) => {
                // match event {
                //     Ok(IndexingProgress::GotItem { .. }) => debug!("DEBUG: GotItem"),
                //     Ok(IndexingProgress::Finished { .. }) => debug!("DEBUG: Finished"),
                //     Ok(IndexingProgress::Progress { .. }) => debug!("DEBUG: Progress"),
                //     Ok(IndexingProgress::Stopped { .. }) => debug!("DEBUG: Stopped"),
                //     Err(Notification { .. }) => debug!("DEBUG: Notification"),
                // };
                Ok(Some(event))
            }
            Err(cc::RecvTimeoutError::Timeout) => Ok(None),
            Err(cc::RecvTimeoutError::Disconnected) => {
                debug!("Channel got disconnected (receiving from channel in libuv-thread)");
                Err("Event-channel was Disconnected (receiving in channels.rs)".to_string())
            }
        }
    }

    // After the `perform` method has returned, the `complete` method is
    // scheduled on the main thread. It is responsible for converting the
    // Rust data structure into a JS object.
    fn complete(
        self,
        mut cx: TaskContext,
        event: Result<Self::Output, Self::Error>,
    ) -> JsResult<Self::JsEvent> {
        // Receive the event or return early with the error
        let event: Option<Result<IndexingProgress<T>, Notification>> =
            event.or_else(|err| cx.throw_error(&err))?;

        // Timeout occured, return early with `undefined
        let event: IndexingResults<T> = match event {
            Some(event) => event,
            None => return Ok(JsUndefined::new().upcast()),
        };
        // Create an empty object `{}`
        Ok(match event {
            Ok(IndexingProgress::Progress { ticks: (n, total) }) => {
                let o = cx.empty_object();
                let event_name = cx.string("Progress");
                let ticked = cx.number(n as f64);
                let total = cx.number(total as f64);

                o.set(&mut cx, "event", event_name)?;
                o.set(&mut cx, "ellapsed", ticked)?;
                o.set(&mut cx, "total", total)?;
                o.upcast()
            }
            Ok(IndexingProgress::GotItem { item: chunk }) => {
                trace!("GotItem...{:?}", chunk);
                error!("item parsing to JsObject not implemented!");
                cx.empty_object().upcast()
                /*
                let event_name = cx.string("GotItem");
                match serde_json::to_value(&mut cx, &chunk) {
                    Ok(js_value) => {
                        trace!("Try to downcast {:?}", chunk);
                        match js_value.downcast::<JsObject>() {
                            Ok(o) => {
                                o.set(&mut cx, "event", event_name)?;
                                o.upcast()
                            }
                            Err(e) => {
                                error!("error in downcasting object: {}...will throw js error", e);
                                let o: Handle<JsObject> = js_value.downcast_or_throw(&mut cx)?;
                                o.set(&mut cx, "event", event_name)?;
                                o.upcast()
                            }
                        }
                    }
                    Err(e) => {
                        error!("error in converting to js: {}", e);
                        cx.empty_object().upcast()
                    }
                }
                */
            }
            Ok(IndexingProgress::Stopped) => {
                let o = cx.empty_object();
                let event_name = cx.string("Stopped");
                o.set(&mut cx, "event", event_name)?;
                o.upcast()
            }
            Err(Notification {
                severity,
                content,
                line,
            }) => {
                let o = cx.empty_object();
                let event_name = cx.string("Notification");
                o.set(&mut cx, "event", event_name)?;
                let severity_val = cx.string(severity.as_str());
                let content_val = cx.string(content);
                o.set(&mut cx, "severity", severity_val)?;
                o.set(&mut cx, "content", content_val)?;
                if let Some(index) = line {
                    let line_val = cx.number(index as f64);
                    o.set(&mut cx, "line", line_val)?;
                }
                o.upcast()
            }
            Ok(IndexingProgress::Finished) => {
                let o = cx.empty_object();
                let event_name = cx.string("Finished");
                o.set(&mut cx, "event", event_name)?;
                o.upcast()
            }
        })
    }
}
