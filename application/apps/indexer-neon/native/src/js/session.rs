// use crate::js::events::{CallbackEvent, Channel, ComputationError, Done, ShutdownReceiver};
// // use crate::js::grabber_action::GrabberAction;
// use crate::js::search::SearchAction;
// use crate::mock::MockWork;
// use crossbeam_channel as cc;
// use indexer_base::progress::{IndexingProgress, IndexingResults};
// use neon::{handle::Handle, prelude::*};
// use processor::grabber::Grabber;
// use std::path::Path;
// use std::path::PathBuf;
// use std::sync::{Arc, Mutex};
// use std::thread;

// pub trait OperationAction {
//     /// possibly longruning blocking action
//     /// might report about progress using the result_sender channel
//     /// when this function returns, the action has completed
//     fn prepare(
//         &self,
//         result_sender: cc::Sender<IndexingResults<()>>,
//         shutdown_rx: Option<ShutdownReceiver>,
//     ) -> Result<(), ComputationError>;

//     fn sync_op(&mut self, _v1: u64, _v2: u64) -> Result<Vec<String>, ComputationError> {
//         Err(ComputationError::OperationNotSupported(
//             "grab_section not implemented".to_owned(),
//         ))
//     }

//     /// indicates if the action is a search request
//     fn is_search(&self) -> bool {
//         false
//     }
//     // fn (bool) -> bool
//     // fn (u64) -> bool
//     // fn (bool) -> u64
// }

// /// A session is kept for every open tab in chipmunk. It is used to manage all data related
// /// to a tab, e.g. data sources, ongoing grabber and/or search operations
// pub struct Session {
//     pub id: String,
//     pub live_operations: Vec<Operation>,
//     pub session_file_path: PathBuf,
// }

// impl Session {
//     pub fn operation(&self, key: &str) -> Option<&Operation> {
//         self.live_operations.iter().find(|&op| key == op.key)
//     }

//     pub fn end_operation(&mut self, key: &str) -> Option<()> {
//         self.live_operations.iter_mut().find_map(|op| {
//             if op.key == key {
//                 op.clear();
//                 let _ = op.shutdown_channel.0.send(());
//                 Some(())
//             } else {
//                 None
//             }
//         })
//     }
// }

// pub struct Operation {
//     pub shutdown_channel: Channel<()>,
//     pub(crate) handler: Option<EventHandler>,
//     pub action: Option<Arc<Mutex<dyn OperationAction + Sync + Send>>>,
//     pub key: String,
// }

// impl Operation {
//     fn new(key: &str) -> Self {
//         Self {
//             shutdown_channel: cc::unbounded(),
//             handler: None,
//             action: None,
//             key: key.to_owned(),
//         }
//     }

//     pub fn clear(&mut self) {
//         self.handler = None;
//         self.action = None;
//     }

//     pub fn set_event_handler(&mut self, handler: EventHandler) {
//         self.handler = Some(handler);
//     }

//     pub fn start_listening_for_events(
//         javascript_listener: neon::event::EventHandler,
//         progress_receiver: cc::Receiver<IndexingResults<()>>,
//     ) {
//         thread::spawn(move || {
//             log::debug!("Started progress listener thread");

//             loop {
//                 match progress_receiver.recv() {
//                     Ok(indexing_res) => match indexing_res {
//                         Ok(progress) => match progress {
//                             IndexingProgress::Stopped => {
//                                 log::debug!("Computation was stopped");
//                                 break;
//                             }
//                             IndexingProgress::Finished => {
//                                 log::debug!("Computation has finished");
//                                 break;
//                             }
//                             IndexingProgress::Progress { ticks } => {
//                                 javascript_listener.schedule_with(move |cx, this, callback| {
//                                     let args: Vec<Handle<JsValue>> = vec![
//                                         cx.string(CallbackEvent::Progress.to_string()).upcast(),
//                                         cx.number(ticks.0 as f64).upcast(),
//                                         cx.number(ticks.1 as f64).upcast(),
//                                     ];
//                                     if let Err(e) = callback.call(cx, this, args) {
//                                         log::error!("Calling javascript callback failed: {}", e);
//                                     }
//                                 });
//                             }
//                             IndexingProgress::GotItem { item } => {
//                                 // TODO: do we still need that?
//                                 log::debug!("Got an item: {:?}, NOT forwarding!", item);
//                             }
//                         },
//                         Err(notification) => {
//                             log::debug!("Forwarding notification: {:?}", notification);
//                             javascript_listener.schedule_with(move |cx, this, callback| {
//                                 let mut args: Vec<Handle<JsValue>> = vec![
//                                     cx.string(CallbackEvent::Notification.to_string()).upcast(),
//                                     cx.string(notification.severity.as_str()).upcast(),
//                                     cx.string(notification.content).upcast(),
//                                 ];
//                                 if let Some(line) = notification.line {
//                                     args.push(cx.number(line as f64).upcast());
//                                 }
//                                 if let Err(e) = callback.call(cx, this, args) {
//                                     log::error!("Calling javascript callback failed: {}", e);
//                                 }
//                             });
//                         }
//                     },
//                     Err(e) => log::warn!("Error receiving progress: {}", e),
//                 }
//             }
//             log::debug!("Exit progress listener thread");
//         });
//     }
// }

// /// all possible operations are constructed here
// /// each operation has a key, e.g. "SEARCH" that is passed from node
// /// along with the required arguments
// pub fn look_up_work(
//     key: &str,
//     session_path: &Path,
//     data1: &str,
// ) -> Option<Arc<Mutex<dyn OperationAction + Sync + Send>>> {
//     match key {
//         "MOCK" => Some(Arc::new(Mutex::new(MockWork::new()))),
//         "SEARCH" => {
//             let shutdown_channel = cc::unbounded();
//             let chunk_result_channel: (
//                 cc::Sender<IndexingResults<()>>,
//                 cc::Receiver<IndexingResults<()>>,
//             ) = cc::unbounded();
//             match SearchAction::new(
//                 session_path,
//                 data1, // == regex
//                 shutdown_channel,
//                 chunk_result_channel,
//             ) {
//                 Ok(a) => Some(Arc::new(Mutex::new(a))),
//                 Err(e) => {
//                     log::warn!("Could not create search action: {}", e);
//                     None
//                 }
//             }
//         }
//         // "GRABBER" => {
//         //     let shutdown_channel = cc::unbounded();
//         //     let metadata_channel = cc::bounded(1);
//         //     let chunk_result_channel: (
//         //         cc::Sender<IndexingResults<()>>,
//         //         cc::Receiver<IndexingResults<()>>,
//         //     ) = cc::unbounded();
//         //     match Grabber::lazy(session_path) {
//         //         Ok(grabber) => Some(Arc::new(Mutex::new(GrabberAction {
//         //             grabber,
//         //             handler: None,
//         //             shutdown_channel,
//         //             metadata_channel,
//         //             event_channel: chunk_result_channel,
//         //         }))),
//         //         Err(e) => {
//         //             log::error!("Error creating grabber: {}", e);
//         //             None
//         //         }
//         //     }
//         // }
//         _ => {
//             log::warn!("Operation for {} not registered", key);
//             None
//         }
//     }
// }

// declare_types! {

//     pub class JsSession for Session {
//         init(mut _cx) {
//             let id = _cx.argument::<JsString>(0)?.value();
//             let session_file_path_str = _cx.argument::<JsString>(1)?.value();
//             println!("init: {} for path: {}", id.as_str(), session_file_path_str);
//             let session_file_path = PathBuf::from(&session_file_path_str);
//             if !session_file_path.exists() {
//                 _cx.throw_error(format!("No file exists here: {}", session_file_path_str))
//             } else {
//                 Ok(Session {
//                     id,
//                     session_file_path,
//                     live_operations: vec![],
//                 })
//             }
//         }

//         constructor(_cx) {
//             Ok(None)
//         }

//         method add_operation(mut cx) {
//             let op_key = cx.argument::<JsString>(0)?.value();
//             let data1 = cx.argument::<JsString>(1)?.value();
//             let callback = cx.argument::<JsFunction>(2)?;
//             let mut this = cx.this();
//             let mut operation = Operation::new(&op_key);
//             let handler = EventHandler::new(&cx, this, callback);

//             let session_path = {
//                 let guard = cx.lock();
//                 let this = this.borrow(&guard);
//                 this.session_file_path.clone()
//             };
//             operation.action = look_up_work(&op_key, &session_path, &data1);
//             operation.set_event_handler(handler);
//             println!("add operation {}", op_key);
//             let res = {
//                 let guard = cx.lock();
//                 let mut this_mut = this.borrow_mut(&guard);
//                 if this_mut.operation(&op_key).is_some() {
//                     println!("operation could not be added, already in");
//                     false
//                 } else {
//                     this_mut.live_operations.push(operation);
//                     println!("added operation {}", op_key);
//                     true
//                 }
//             };
//             if res {
//                 Ok(cx.undefined().upcast())
//             } else {
//                 cx.throw_error(format!("Operation with id [{}] already registered", op_key))
//             }
//         }

//         method async_function(mut cx) {
//             let id = cx.argument::<JsString>(0)?.value();
//             let this = cx.this();
//             let error = {
//                 let guard = cx.lock();
//                 let this = this.borrow(&guard);
//                 let operation = this.operation(&id);
//                 match operation {
//                     Some(op) => {
//                         let (handler, shutdown_receiver, action) =
//                             (op.handler.clone(), op.shutdown_channel.1.clone(), op.action.clone());
//                         match (handler, action, id) {
//                             (Some(event_handler), Some(action), _id) => {
//                                 let (event_tx, event_rx) = cc::unbounded();
//                                 Operation::start_listening_for_events(event_handler.clone(), event_rx);
//                                 thread::spawn(move || {
//                                     log::debug!("Created rust thread for task execution");

//                                     // TODO get rid of unwrap
//                                     if let Err(e) = action.lock().unwrap().prepare(event_tx, Some(shutdown_receiver)) {
//                                         log::error!("Error on async function: {}", e);
//                                     }
//                                     event_handler.schedule_with(move |cx, this, callback| {
//                                         let args : Vec<Handle<JsValue>> = vec![
//                                             cx.string(CallbackEvent::Done(Done::Finished).to_string()).upcast(),
//                                             cx.string("FINISHED").upcast()];
//                                         if let Err(e) = callback.call(cx, this, args) {
//                                             log::error!("Error on calling js callback: {}", e);
//                                         }
//                                     });
//                                     log::debug!("RUST: exiting worker thread");
//                                 });
//                                 None
//                             }
//                             (None, None, _id) => {
//                                 Some("No event-handler, no action function found in Session".to_string())
//                             }
//                             (_, None, id) => {
//                                 Some(format!("No action function for {:?} found in Session", id))
//                             }
//                             (None, _, _id) => {
//                                 Some("No event-handler found in Session".to_string())
//                             }
//                         }
//                     }
//                     None => Some(format!("Operation with id [{}] not found", id)),
//                 }
//             };
//             match error {
//                 None => Ok(cx.undefined().upcast()),
//                 Some(e) => cx.throw_error(e)
//             }
//         }

//         method sync_function(mut cx) {
//             let id = cx.argument::<JsString>(0)?.value();
//             let v1: u64 = cx.argument::<JsNumber>(1)?.value() as u64;
//             let v2: u64 = cx.argument::<JsNumber>(2)?.value() as u64;
//             let this = cx.this();
//             // TODO: more generic
//             let array: Handle<JsArray> = JsArray::new(&mut cx, v2 as u32);
//             let res = {
//                 let guard = cx.lock();
//                 let this = this.borrow(&guard);
//                 let operation = this.operation(&id);

//                 match operation {
//                     Some(op) => {
//                         match &op.action {
//                             Some(action) => action.lock().unwrap().sync_op(v1, v2),
//                             None => Err(ComputationError::Communication(format!("Could not lock the action for id {}", id))),
//                         }
//                     }
//                     None => Err(ComputationError::Communication(format!("No operation with id {} found", id))),
//                 }
//             };

//             match res {
//                 Err(e) => {
//                     log::error!("Error on sync function: {}", e);
//                     cx.throw_error(format!("Error on sync function: {}", e))
//                 },
//                 Ok(lines) => {
//                     for (i, x) in lines.into_iter().enumerate() {
//                         let s = cx.string(x);
//                         array.set(&mut cx, i as u32, s)?;
//                     }
//                     Ok(array.as_value(&mut cx))
//                 },
//             }
//         }

//         method shutdown_operation(mut cx) {
//             let id = cx.argument::<JsString>(0)?.value();
//             log::info!("Shutdown operation {}", id);
//             let mut this = cx.this();
//             let ended = {
//                 let guard = cx.lock();
//                 let mut this_mut = this.borrow_mut(&guard);
//                 this_mut.end_operation(&id)
//             };
//             match ended {
//                 Some(()) => Ok(cx.undefined().upcast()),
//                 None => cx.throw_error(format!("No operation with id {} live", id)),
//             }
//         }
//     }
// }
