use crate::js::events::{CallbackEvent, Channel, ComputationError, ShutdownReceiver};
use crate::js::grabber_session::GrabberHolder;
use crate::mock::MockWork;
use crossbeam_channel as cc;
use indexer_base::progress::{IndexingProgress, IndexingResults};
use neon::{handle::Handle, prelude::*};
use processor::grabber::Grabber;
use std::sync::{Arc, Mutex};
use std::thread;

// pub type SessionFunction =
//     fn(cc::Sender<IndexingResults<()>>, Option<ShutdownReceiver>) -> Result<(), ComputationError>;

pub trait SessionAction {
    fn execute(
        &self,
        result_sender: cc::Sender<IndexingResults<()>>,
        shutdown_rx: Option<ShutdownReceiver>,
    ) -> Result<(), ComputationError>;

    fn sync_computation(&mut self, v1: u64, v2: u64) -> Result<Vec<String>, ComputationError>;
}

pub struct Session {
    pub shutdown_channel: Channel<()>,
    pub(crate) handler: Option<EventHandler>,
    pub action: Option<Arc<Mutex<dyn SessionAction + Sync + Send>>>,
    pub id: Option<String>,
}
impl Default for Session {
    fn default() -> Self {
        Self {
            shutdown_channel: cc::unbounded(),
            handler: None,
            action: None,
            id: None,
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

impl Session {
    pub fn clear(&mut self) {
        self.handler = None;
        self.id = None;
        self.action = None;
    }

    pub fn set_event_handler(&mut self, handler: EventHandler) {
        self.handler = Some(handler);
    }

    pub fn start_listening_for_events(
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

pub fn look_up_work(
    id: &str,
    data1: &str,
    data2: &str,
) -> Option<Arc<Mutex<dyn SessionAction + Sync + Send>>> {
    match id {
        "MOCK" => Some(Arc::new(Mutex::new(MockWork::new()))),
        "GRABBER" => {
            let path = data1;
            let shutdown_channel = cc::unbounded();
            let metadata_channel = cc::bounded(1);
            let chunk_result_channel: (
                cc::Sender<IndexingResults<()>>,
                cc::Receiver<IndexingResults<()>>,
            ) = cc::unbounded();
            match Grabber::lazy(path) {
                Ok(grabber) => Some(Arc::new(Mutex::new(GrabberHolder {
                    grabber,
                    handler: None,
                    shutdown_channel,
                    metadata_channel,
                    event_channel: chunk_result_channel,
                }))),
                Err(e) => {
                    log::error!("Error...{}", e);
                    None
                }
            }
        }
        _ => {
            log::warn!("Function for {} not registered", id);
            None
        }
    }
}

declare_types! {
    pub class JsSession for Session {
        init(mut _cx) {
            let id = _cx.argument::<JsString>(0)?.value();
            println!("init: {}", id.as_str());
            Ok(Session::default())
        }

        constructor(mut cx) {
            let id = cx.argument::<JsString>(0)?.value();
            let data1 = cx.argument::<JsString>(1)?.value();
            let data2 = cx.argument::<JsString>(2)?.value();
            println!("constructor: {}", id.as_str());
            let mut this = cx.this();
            let f = cx.argument::<JsFunction>(3)?;
            let handler = EventHandler::new(&cx, this, f);
            {
                let guard = cx.lock();
                let mut this_mut = this.borrow_mut(&guard);
                this_mut.action = look_up_work(&id, &data1, &data2);
                this_mut.id = Some(id);
                this_mut.set_event_handler(handler);
            }
            Ok(None)
        }

        method async_function(mut cx) {
            let this = cx.this();
            let (handler, shutdown_receiver, action, id) = {
                let guard = cx.lock();
                let this = this.borrow(&guard);
                (this.handler.clone(), this.shutdown_channel.1.clone(), this.action.clone(), this.id.clone())
            };
            match (handler, action, id) {
                (Some(event_handler), Some(action), _id) => {
                    let (event_tx, event_rx) = cc::unbounded();
                    Session::start_listening_for_events(event_handler.clone(), event_rx);
                    thread::spawn(move || {
                        log::debug!("Created rust thread for task execution");

                        // TODO get rid of unwrap
                        if let Err(e) = action.lock().unwrap().execute(event_tx, Some(shutdown_receiver)) {
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
                (None, None, _id) => {
                    cx.throw_error("No event-handler, no action function found in Session")
                }
                (_, None, id) => {
                    cx.throw_error(format!("No action function for {:?} found in Session", id))
                }
                (None, _, _id) => {
                    cx.throw_error("No event-handler found in Session")
                }
            }
        }

        method sync_function(mut cx) {
            let v1: u64 = cx.argument::<JsNumber>(0)?.value() as u64;
            let v2: u64 = cx.argument::<JsNumber>(1)?.value() as u64;
            let this = cx.this();
            let (action, id) = {
                let guard = cx.lock();
                let this = this.borrow(&guard);
                (this.action.clone(), this.id.clone())
            };
            // TODO: more generic
            let array: Handle<JsArray> = JsArray::new(&mut cx, v2 as u32);
            match action {
                // TODO get rid of unwrap
                Some(action) => match action.lock().unwrap().sync_computation(v1, v2) {
                    Err(e) => {
                        log::error!("Error on sync function: {}", e);
                        cx.throw_error(format!("Error on sync function: {}", e))
                    },
                    Ok(lines) => {
                        for (i, x) in lines.into_iter().enumerate() {
                            let s = cx.string(x);
                            array.set(&mut cx, i as u32, s)?;
                        }
                        Ok(array.as_value(&mut cx))
                    },
                }
                None => cx.throw_error(format!("No action function for {:?} found in Session", id)),
            }
        }

        method shutdown(mut cx) {
            log::info!("Shutdown Session");
            let mut this = cx.this();
            {
                let guard = cx.lock();
                let mut session = this.borrow_mut(&guard);
                session.clear();
                let _ = session.shutdown_channel.0.send(());
            }
            Ok(cx.undefined().upcast())
        }
    }
}
