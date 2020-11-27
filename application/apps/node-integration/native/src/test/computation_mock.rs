use crate::js::events::*;
use crossbeam_channel as cc;
use indexer_base::{
    progress::{IndexingProgress, IndexingResults},
    utils,
};
use neon::{handle::Handle, prelude::*};
use std::{thread, time};
use thiserror::Error;

type Channel<T> = (cc::Sender<T>, cc::Receiver<T>);
type ShutdownReceiver = cc::Receiver<()>;

#[derive(Error, Debug)]
pub enum ComputationError {
    #[error("Communication error ({0})")]
    Communication(String),
}

// type SessionFunction =
//     fn(cc::Sender<IndexingResults<()>>, Option<ShutdownReceiver>) -> Result<(), ComputationError>;

pub struct Session {
    pub shutdown_channel: Channel<()>,
    handler: Option<EventHandler>,
    // work: Option<
    //     Box<
    //         dyn Fn(...) -> Result<(), ComputationError>,
    //     >,
    // >,
}
impl Default for Session {
    fn default() -> Self {
        Self {
            shutdown_channel: cc::unbounded(),
            handler: None,
        }
    }
}

pub trait RustAsyncWork {
    fn execute(
        &self,
        result_sender: cc::Sender<IndexingResults<()>>,
        shutdown_rx: Option<ShutdownReceiver>,
    ) -> Result<(), ComputationError>;
}

struct MockWork {}
impl RustAsyncWork for MockWork {
    fn execute(
        &self,
        result_sender: cc::Sender<IndexingResults<()>>,
        shutdown_rx: Option<ShutdownReceiver>,
    ) -> Result<(), ComputationError> {
        let total_work = 4u64;
        for i in 0..total_work {
            if utils::check_if_stop_was_requested(shutdown_rx.as_ref(), "computation-mock") {
                result_sender
                    .send(Ok(IndexingProgress::Stopped))
                    .map_err(|_| {
                        ComputationError::Communication(
                            "Could not send Finished progress".to_string(),
                        )
                    })?;
                return Ok(());
            }
            println!("RUST: work-progress: {}", i);
            result_sender
                .send(Ok(IndexingProgress::Progress {
                    ticks: (i + 1, total_work),
                }))
                .map_err(|_| {
                    ComputationError::Communication("Could not send progress".to_string())
                })?;
            thread::sleep(time::Duration::from_millis(200));
        }
        result_sender
            .send(Ok(IndexingProgress::Finished))
            .map_err(|_| {
                ComputationError::Communication("Could not send Finished progress".to_string())
            })?;
        Ok(())
    }
}

impl Session {
    pub fn initialize(
        result_sender: cc::Sender<IndexingResults<()>>,
        shutdown_rx: Option<ShutdownReceiver>,
    ) -> Result<(), ComputationError> {
        let total_work = 4u64;
        for i in 0..total_work {
            if utils::check_if_stop_was_requested(shutdown_rx.as_ref(), "computation-mock") {
                result_sender
                    .send(Ok(IndexingProgress::Stopped))
                    .map_err(|_| {
                        ComputationError::Communication(
                            "Could not send Finished progress".to_string(),
                        )
                    })?;
                return Ok(());
            }
            println!("RUST: work-progress: {}", i);
            result_sender
                .send(Ok(IndexingProgress::Progress {
                    ticks: (i + 1, total_work),
                }))
                .map_err(|_| {
                    ComputationError::Communication("Could not send progress".to_string())
                })?;
            thread::sleep(time::Duration::from_millis(200));
        }
        result_sender
            .send(Ok(IndexingProgress::Finished))
            .map_err(|_| {
                ComputationError::Communication("Could not send Finished progress".to_string())
            })?;
        Ok(())
    }

    fn start_listening_for_events(
        javascript_listener: neon::event::EventHandler,
        progress_receiver: cc::Receiver<IndexingResults<()>>,
    ) {
        thread::spawn(move || {
            log::debug!("Started progress listener thread");

            loop {
                match progress_receiver.recv() {
                    Ok(indexing_res) => match indexing_res {
                        Ok(progress) => match progress {
                            IndexingProgress::Stopped => {
                                log::debug!("Computation was stopped");
                                break;
                            }
                            IndexingProgress::Finished => {
                                log::debug!("Computation has finished");
                                break;
                            }
                            IndexingProgress::Progress { ticks } => {
                                javascript_listener.schedule_with(move |cx, this, callback| {
                                    let args: Vec<Handle<JsValue>> = vec![
                                        cx.string(CallbackEvent::Progress.to_string()).upcast(),
                                        cx.number(ticks.0 as f64).upcast(),
                                        cx.number(ticks.1 as f64).upcast(),
                                    ];
                                    if let Err(e) = callback.call(cx, this, args) {
                                        log::error!("Calling javascript callback failed: {}", e);
                                    }
                                });
                            }
                            IndexingProgress::GotItem { item } => {
                                // TODO: do we still need that?
                                log::debug!("Got an item: {:?}, NOT forwarding!", item);
                            }
                        },
                        Err(notification) => {
                            log::debug!("Forwarding notification: {:?}", notification);
                            javascript_listener.schedule_with(move |cx, this, callback| {
                                let mut args: Vec<Handle<JsValue>> = vec![
                                    cx.string(CallbackEvent::Notification.to_string()).upcast(),
                                    cx.string(notification.severity.as_str()).upcast(),
                                    cx.string(notification.content).upcast(),
                                ];
                                if let Some(line) = notification.line {
                                    args.push(cx.number(line as f64).upcast());
                                }
                                if let Err(e) = callback.call(cx, this, args) {
                                    log::error!("Calling javascript callback failed: {}", e);
                                }
                            });
                        }
                    },
                    Err(e) => log::warn!("Error receiving progress: {}", e),
                }
            }
            log::debug!("Exit progress listener thread");
        });
    }
}

impl Session {
    fn set_event_handler(&mut self, handler: EventHandler) {
        self.handler = Some(handler);
    }
}

declare_types! {
    pub class JsSession for Session {
        init(mut _cx) {
            Ok(Session::default())
        }

        constructor(mut cx) {
            let mut this = cx.this();
            let f = cx.argument::<JsFunction>(0)?;
            let handler = EventHandler::new(&cx, this, f);
            {
                let guard = cx.lock();
                this.borrow_mut(&guard).set_event_handler(handler);
            }
            Ok(None)
        }

        method async_function(mut cx) {
            let this = cx.this();
            let (handler, shutdown_receiver) = {
                let guard = cx.lock();
                let this = this.borrow(&guard);
                (this.handler.clone(), this.shutdown_channel.1.clone())
            };
            match handler {
                Some(event_handler) => {
                    let (event_tx, event_rx) = cc::unbounded();
                    Session::start_listening_for_events(event_handler.clone(), event_rx);
                    thread::spawn(move || {
                        log::debug!("Created rust thread for task execution");

                        if let Err(e) = Session::initialize(event_tx, Some(shutdown_receiver)) {
                            log::error!("Error on async function: {}", e);
                        }
                        event_handler.schedule_with(move |cx, this, callback| {
                            let args : Vec<Handle<JsValue>> = vec![cx.string(CallbackEvent::Done.to_string()).upcast()];
                            if let Err(e) = callback.call(cx, this, args) {
                                log::error!("Error on calling js callback: {}", e);
                            }
                        });
                        log::debug!("RUST: exiting worker thread");
                    });
                    Ok(cx.undefined().upcast())
                }
                None => {
                    cx.throw_error("No event-handler found in Session")
                }
            }
        }

        method sync_function(mut cx) {
            let start_line_index: u64 = cx.argument::<JsNumber>(0)?.value() as u64;
            let result = cx.string(format!("hello {}", start_line_index));
            Ok(result.upcast())
        }

        method shutdown(mut cx) {
            log::info!("Shutdown Session");
            let mut this = cx.this();
            {
                let guard = cx.lock();
                let mut callback = this.borrow_mut(&guard);
                callback.handler = None;
                let _ = callback.shutdown_channel.0
                    .send(());

            }
            Ok(cx.undefined().upcast())
        }
    }
}
