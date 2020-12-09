use crate::js::events::{CallbackEvent, Channel, ComputationError, ShutdownReceiver};
use crate::js::grabber_session::GrabberAction;
use crate::mock::MockWork;
use crossbeam_channel as cc;
use indexer_base::progress::{IndexingProgress, IndexingResults};
use neon::{handle::Handle, prelude::*};
use processor::grabber::Grabber;
use std::sync::{Arc, Mutex};
use std::thread;

pub trait OperationAction {
    fn prepare_async(
        &self,
        result_sender: cc::Sender<IndexingResults<()>>,
        shutdown_rx: Option<ShutdownReceiver>,
    ) -> Result<(), ComputationError>;

    fn sync_computation(&mut self, _v1: u64, _v2: u64) -> Result<Vec<String>, ComputationError> {
        Ok(vec![])
    }
}

pub struct Session {
    pub id: String,
    pub live_operations: Vec<Operation>,
}

impl Session {
    pub fn operation(&self, id: &str) -> Option<&Operation> {
        self.live_operations.iter().find(|&op| id == op.id)
    }

    pub fn end_operation(&mut self, id: &str) -> Option<()> {
        self.live_operations.iter_mut().find_map(|op| {
            if op.id == id {
                op.clear();
                let _ = op.shutdown_channel.0.send(());
                Some(())
            } else {
                None
            }
        })
    }
}

pub struct Operation {
    pub shutdown_channel: Channel<()>,
    pub(crate) handler: Option<EventHandler>,
    pub action: Option<Arc<Mutex<dyn OperationAction + Sync + Send>>>,
    pub id: String,
}

impl Operation {
    fn new(id: &str) -> Self {
        Self {
            shutdown_channel: cc::unbounded(),
            handler: None,
            action: None,
            id: id.to_owned(),
        }
    }

    pub fn clear(&mut self) {
        self.handler = None;
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
    _data2: &str,
) -> Option<Arc<Mutex<dyn OperationAction + Sync + Send>>> {
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
                Ok(grabber) => Some(Arc::new(Mutex::new(GrabberAction {
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
            Ok(Session {
                id,
                live_operations: vec![],
            })
        }

        constructor(_cx) {
            Ok(None)
        }

        method add_operation(mut cx) {
            let id = cx.argument::<JsString>(0)?.value();
            let data1 = cx.argument::<JsString>(1)?.value();
            let data2 = cx.argument::<JsString>(2)?.value();
            let f = cx.argument::<JsFunction>(3)?;
            let mut this = cx.this();
            let mut operation = Operation::new(&id);
            let handler = EventHandler::new(&cx, this, f);
            operation.action = look_up_work(&id, &data1, &data2);
            operation.set_event_handler(handler);
            println!("add operation {}", id);
            let res = {
                let guard = cx.lock();
                let mut this_mut = this.borrow_mut(&guard);
                if this_mut.operation(&id).is_some() {
                    println!("operation could not be added, already in");
                    false
                } else {
                    this_mut.live_operations.push(operation);
                    println!("added operation {}", id);
                    true
                }
            };
            if res {
                Ok(cx.undefined().upcast())
            } else {
                cx.throw_error(format!("Operation with id [{}] already registered", id))
            }
        }

        method async_function(mut cx) {
            let id = cx.argument::<JsString>(0)?.value();
            let this = cx.this();
            let error = {
                let guard = cx.lock();
                let this = this.borrow(&guard);
                let operation = this.operation(&id);
                match operation {
                    Some(op) => {
                        let (handler, shutdown_receiver, action) =
                            (op.handler.clone(), op.shutdown_channel.1.clone(), op.action.clone());
                        match (handler, action, id) {
                            (Some(event_handler), Some(action), _id) => {
                                let (event_tx, event_rx) = cc::unbounded();
                                Operation::start_listening_for_events(event_handler.clone(), event_rx);
                                thread::spawn(move || {
                                    log::debug!("Created rust thread for task execution");

                                    // TODO get rid of unwrap
                                    if let Err(e) = action.lock().unwrap().prepare_async(event_tx, Some(shutdown_receiver)) {
                                        log::error!("Error on async function: {}", e);
                                    }
                                    event_handler.schedule_with(move |cx, this, callback| {
                                        let args : Vec<Handle<JsValue>> = vec![
                                            cx.string(CallbackEvent::Done.to_string()).upcast(),
                                            cx.string("FINISHED").upcast()];
                                        if let Err(e) = callback.call(cx, this, args) {
                                            log::error!("Error on calling js callback: {}", e);
                                        }
                                    });
                                    log::debug!("RUST: exiting worker thread");
                                });
                                None
                            }
                            (None, None, _id) => {
                                Some("No event-handler, no action function found in Session".to_string())
                            }
                            (_, None, id) => {
                                Some(format!("No action function for {:?} found in Session", id))
                            }
                            (None, _, _id) => {
                                Some("No event-handler found in Session".to_string())
                            }
                        }
                    }
                    None => Some(format!("Operation with id [{}] not found", id)),
                }
            };
            match error {
                None => Ok(cx.undefined().upcast()),
                Some(e) => cx.throw_error(e)
            }
        }

        method sync_function(mut cx) {
            let id = cx.argument::<JsString>(0)?.value();
            let v1: u64 = cx.argument::<JsNumber>(1)?.value() as u64;
            let v2: u64 = cx.argument::<JsNumber>(2)?.value() as u64;
            let this = cx.this();
            // TODO: more generic
            let array: Handle<JsArray> = JsArray::new(&mut cx, v2 as u32);
            let res = {
                let guard = cx.lock();
                let this = this.borrow(&guard);
                let operation = this.operation(&id);

                match operation {
                    Some(op) => {
                        match &op.action {
                            Some(action) => action.lock().unwrap().sync_computation(v1, v2),
                            None => Err(ComputationError::Communication(format!("Could not lock the action for id {}", id))),
                        }
                    }
                    None => Err(ComputationError::Communication(format!("No operation with id {} found", id))),
                }
            };

            match res {
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
        }

        method shutdown_operation(mut cx) {
            let id = cx.argument::<JsString>(0)?.value();
            log::info!("Shutdown operation {}", id);
            let mut this = cx.this();
            let ended = {
                let guard = cx.lock();
                let mut this_mut = this.borrow_mut(&guard);
                this_mut.end_operation(&id)
            };
            match ended {
                Some(()) => Ok(cx.undefined().upcast()),
                None => cx.throw_error(format!("No operation with id {} live", id)),
            }
        }
    }
}
