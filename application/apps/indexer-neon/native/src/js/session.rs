use crate::js::events::Channel;
use crate::js::events::{CallbackEvent, ComputationError};
use crossbeam_channel as cc;
use indexer_base::progress::{Notification, Progress, Severity};
use neon::prelude::*;
use processor::grabber::GrabbedContent;
use processor::grabber::LineRange;
use processor::grabber::{GrabMetadata, Grabber};
use processor::search::{SearchFilter, SearchHolder};
use serde::Serialize;
use std::path::Path;
use std::sync::Arc;
use std::thread;
use uuid::Uuid;

pub struct RustSession {
    pub id: String,
    pub assigned_file: Option<String>,
    pub content_grabber: Option<Grabber>,
    callback: Root<JsFunction>,
    pub search_grabber: Option<Grabber>,
    // pub(crate) handler: EventHandler,
    pub(crate) queue: Arc<EventQueue>,
    pub filters: Vec<SearchFilter>,
    // channel that allows to propagate shutdown requests to ongoing operations
    shutdown_channel: Channel<()>,
    // channel to store the metadata of a file once available
    metadata_channel: Channel<Result<Option<GrabMetadata>, ComputationError>>,
    // channel to store the metadata of the search results once available
    search_metadata_channel: Channel<Result<Option<GrabMetadata>, ComputationError>>,
}

enum GrabberKind {
    Content,
    Search,
}

impl RustSession {
    pub fn start_listening_for_progress(
        &self,
        uuid: Uuid,
        // javascript_listener: neon::event::EventHandler,
    ) -> cc::Sender<Progress> {
        let (progress_tx, progress_rx): Channel<Progress> = cc::unbounded();
        thread::spawn(move || {
            log::debug!("Started progress listener thread");

            loop {
                match progress_rx.recv() {
                    Ok(progress) => {
                        let operation_done = match &progress {
                            Progress::Ticks(ticks) => ticks.done(),
                            Progress::Stopped => true,
                            _ => false,
                        };
                        log::info!("Received progress: {:?}", progress);
                        if let Err(e) = send_js_event(
                            // &javascript_listener,
                            CallbackEvent::Progress(uuid, progress),
                        ) {
                            log::warn!("Could not send event to js: {}", e);
                        }
                        if operation_done {
                            break;
                        }
                    }
                    Err(e) => {
                        log::debug!("Progress channel was closed: {}", e);
                        break;
                    }
                }
            }
            log::debug!("Exit progress listener thread");
        });
        progress_tx
    }

    fn grab_content_lines(
        &mut self,
        start_line_index: u64,
        number_of_lines: u64,
    ) -> Result<GrabbedContent, ComputationError> {
        self.grab_lines(start_line_index, number_of_lines, GrabberKind::Content)
    }

    fn grab_search_result_lines(
        &mut self,
        start_line_index: u64,
        number_of_lines: u64,
    ) -> Result<GrabbedContent, ComputationError> {
        self.grab_lines(start_line_index, number_of_lines, GrabberKind::Search)
    }

    fn grab_lines(
        &mut self,
        start_line_index: u64,
        number_of_lines: u64,
        grabber_kind: GrabberKind,
    ) -> Result<GrabbedContent, ComputationError> {
        let grabber = match grabber_kind {
            GrabberKind::Content => &mut self.content_grabber,
            GrabberKind::Search => &mut self.search_grabber,
        };
        match grabber {
            Some(grabber) => {
                if grabber.metadata.is_none() {
                    match self.metadata_channel.1.try_recv() {
                        Err(cc::TryRecvError::Empty) => {
                            log::warn!("RUST: metadata not initialized");
                            Err(ComputationError::Protocol(
                                "RUST: metadata not initialized".to_owned(),
                            ))
                        }
                        Err(e) => {
                            let e = format!("RUST: Error receiving from channel: {}", e);
                            log::warn!("{}", e);
                            Err(ComputationError::Process(e))
                        }
                        Ok(Err(e)) => {
                            let e = format!("RUST: Received error from metadata channel: {}", e);
                            log::warn!("{}", e);
                            Err(ComputationError::Process(e))
                        }
                        Ok(Ok(md)) => {
                            println!("RUST: Received completed metadata");
                            grabber.metadata = md;

                            grabber
                                .get_entries(&LineRange::new(
                                    start_line_index,
                                    start_line_index + number_of_lines,
                                ))
                                .map_err(|e| ComputationError::Communication(format!("{}", e)))
                        }
                    }
                } else {
                    grabber
                        .get_entries(&LineRange::new(
                            start_line_index,
                            start_line_index + number_of_lines,
                        ))
                        .map_err(|e| ComputationError::Communication(format!("{}", e)))
                }
            }
            None => Err(ComputationError::Protocol(
                "No file was assinged".to_string(),
            )),
        }
    }
}

fn send_js_event<T: Serialize>(
    // javascript_listener: &neon::event::EventHandler,
    event: T,
) -> Result<(), ComputationError> {
    match serde_json::to_string(&event) {
        Ok(js_string) => {
            // javascript_listener.schedule_with(move |cx, this, callback| {
            //     let args: Vec<Handle<JsValue>> = vec![cx.string(js_string).upcast()];
            //     if let Err(e) = callback.call(cx, this, args) {
            //         log::error!("Error on calling js callback: {}", e);
            //     }
            // });
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Could not convert Event: {}", e);
            log::error!("{}", &error_msg);
            Err(ComputationError::InvalidData)
        }
    }
}

fn foo(session: &RustSession, cx: &neon::context::CallContext<'_, JsRustSession>) -> () {
    let id = session.id.clone();
    println!("id = {}", id);
    // let this = cx.this();
    // let guard = cx.lock();
    // let session = this.borrow(&guard);
    // let (queue, callback) = {
    //     let guard = cx.lock();
    //     // let session = this.borrow(&guard);
    //     (session.queue.clone(), session.callback.clone())
    // };
    // queue.send(|mut cx| {
    //     let callback = callback.into_inner(&mut cx);
    //     let this = cx.undefined();
    //     let args = vec![cx.string(event_string)];

    //     callback.call(&mut cx, this, args)?;
    // });
}

fn send_js_event_cx<T: Serialize>(
    cx: &mut neon::context::CallContext<'_, JsRustSession>,
    // queue: Arc<EventQueue>,
    // callback: Root<JsFunction>,
    event: T,
) -> Result<(), ComputationError> {
    let event_string = serde_json::to_string(&event).map_err(|e| {
        let error_msg = format!("Could not convert Event: {}", e);
        log::error!("{}", &error_msg);
        ComputationError::InvalidData
    })?;
    let error = {
        // let this = cx.this();
        // let guard = cx.lock();
        // let session = this.borrow(&guard);
        // let (queue, callback) = {
        //     let guard = cx.lock();
        //     // let session = this.borrow(&guard);
        //     (session.queue.clone(), session.callback.clone())
        // };
        // queue.send(|mut cx| {
        //     let callback = callback.into_inner(&mut cx);
        //     let this = cx.undefined();
        //     let args = vec![cx.string(event_string)];

        //     callback.call(&mut cx, this, args)?;

        //     Ok(())
        // });
        Some("TODO, NYI".to_owned())
    };
    match error {
        Some(e) => Err(ComputationError::Process(
            "Could not send evnet to JS".to_owned(),
        )),
        None => Ok(()),
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GeneralError {
    severity: Severity,
    message: String,
}

declare_types! {

    pub class JsRustSession for RustSession {
        init(mut cx) {
            let id = cx.argument::<JsString>(0)?.value(&mut cx);
            let callback = cx.argument::<JsFunction>(1)?.root(&mut cx);
            let this = cx.this();
            // let handler = EventHandler::new(&cx, this, callback);
            Ok(RustSession {
                id,
                queue: Arc::new(cx.queue()),
                callback,
                assigned_file: None,
                content_grabber: None,
                search_grabber: None,
                filters: vec![],
                shutdown_channel: cc::unbounded(),
                metadata_channel: cc::unbounded(),
                search_metadata_channel: cc::unbounded(),
            })
        }

        method id(mut cx) {
            let this = cx.this();
            let id = {
                let guard = cx.lock();
                let this = this.borrow(&guard);
                this.id.clone()
            };
            println!("{}", &id);
            Ok(cx.string(id).upcast())
        }

        method cancel_operations(mut cx) {
            let mut this = cx.this();
            {
                let guard = cx.lock();
                let this_mut = this.borrow_mut(&guard);
                let _ = this_mut.shutdown_channel.0.send(());
            }
            Ok(cx.undefined().upcast())
        }

        method assignFile(mut cx) {
            let file_path = cx.argument::<JsString>(0)?.value(&mut cx);
            let source_id = cx.argument::<JsString>(1)?.value(&mut cx);
            let operation_uuid = Uuid::new_v4();
            let operation_uuid_str = operation_uuid.to_string();
            let callback = cx.argument::<JsFunction>(1)?.root(&mut cx);
            let queue = cx.queue();

            let mut this = cx.this();
            let error = {
                let guard = cx.lock();
                let mut this_mut = this.borrow_mut(&guard);
                this_mut.assigned_file = Some(file_path.clone());
                match Grabber::lazy(Path::new(&file_path), &source_id) {
                    Ok(grabber) => {
                        this_mut.content_grabber = Some(grabber);
                        let (shutdown_rx, metadata_tx) =
                            (this_mut.shutdown_channel.1.clone(),
                             this_mut.metadata_channel.0.clone());
                        let progress_tx = this_mut.start_listening_for_progress(operation_uuid); //TODO pass queue
                        thread::spawn(move || {
                            log::debug!("Created rust thread for task execution");
                            match Grabber::create_metadata_for_file(file_path, &progress_tx, Some(shutdown_rx)) {
                                Ok(metadata)=> {
                                    log::info!("received metadata");
                                    let _ = metadata_tx.send(Ok(metadata));
                                    // TODO emit event `StreamUpdated`
                                    queue.send(move |mut cx| {
                                        let callback = callback.into_inner(&mut cx);

                                        let this = cx.undefined();
                                        let null = cx.null();
                                        let args = vec![
                                            cx.null().upcast::<JsValue>(),
                                            // cx.number(result).upcast(),
                                        ];

                                        callback.call(&mut cx, this, args)?;

                                        Ok(())
                                    });

                                    // send_js_event_cx(&mut cx, CallbackEvent::OperationDone(operation_uuid));
                                } //this_mut.content_grabber.unwrap().metadata = metadata,
                                Err(e) => {
                                    let e_str = format!("Error creating grabber for file: {}", e);
                                    log::error!("{}", e_str);
                                    let _ = metadata_tx.send(Err(ComputationError::Process(e_str)));
                                }
                            }
                        });
                        None
                    },
                    Err(e) => {
                        Some(format!("Error creating grabber for file: {}", e))
                    }
                }
            };
            match error {
                Some(e) => cx.throw_error(e),
                None => Ok(cx.string(operation_uuid_str).upcast()),
            }
        }

        // will report the number of entries of the currently assigned file
        // if now file is yet assigned, will return a GeneralError
        method getStreamLen(mut cx) {
            let item_cnt = {
                let this = cx.this();
                let guard = cx.lock();
                let session = this.borrow(&guard);
                match session.content_grabber.as_ref().map(|g| g.metadata.as_ref()) {
                    Some(Some(md)) => md.line_count,
                    _ => 0,
                }
            };
            Ok(cx.number(item_cnt as f64).upcast())
        }

        method grab(mut cx) {
            let start_line_index: u64 = cx.argument::<JsNumber>(0)?.value(&mut cx) as u64;
            let number_of_lines: u64 = cx.argument::<JsNumber>(1)?.value(&mut cx) as u64;
            let mut this = cx.this();
            let error = {
                let guard = cx.lock();
                let mut this_mut = this.borrow_mut(&guard);
                this_mut.grab_content_lines(start_line_index, number_of_lines)
            };
            match error {
                Err(e) => cx.throw_error(e.to_string()),
                Ok(grabbed_content) => {
                    match serde_json::to_string(&grabbed_content) {
                        Ok(js_string) => {
                            Ok(cx.string(js_string).upcast())
                        },
                        Err(e) => {
                            log::error!("Could not convert SearchFilter: {}", e);
                            cx.throw_error(e.to_string())
                        },
                    }
                },
            }
        }

        method grab_search_results(mut cx) {
            let start_line_index: u64 = cx.argument::<JsNumber>(0)?.value(&mut cx) as u64;
            let number_of_lines: u64 = cx.argument::<JsNumber>(1)?.value(&mut cx) as u64;
            let mut this = cx.this();
            let error = {
                let guard = cx.lock();
                let mut this_mut = this.borrow_mut(&guard);
                this_mut.grab_search_result_lines(start_line_index, number_of_lines)
            };
            match error {
                Err(e) => cx.throw_error(e.to_string()),
                Ok(grabbed_content) => {
                    match serde_json::to_string(&grabbed_content) {
                        Ok(js_string) => {
                            Ok(cx.string(js_string).upcast())
                        },
                        Err(e) => {
                            log::error!("Could not convert SearchFilter: {}", e);
                            cx.throw_error(e.to_string())
                        },
                    }
                },
            }
        }

        method setFilters(mut cx) {
            let assigned_file = {
                let this = cx.this();
                let guard = cx.lock();
                let session = this.borrow(&guard);
                session.assigned_file.clone()
            };
            let operation_uuid = Uuid::new_v4();
            match assigned_file {
                None => cx.throw_error("No session file assigned yet"),
                Some(f) => {
            let arg_filters = cx.argument::<JsString>(0)?.value(&mut cx);
            let filter_conf: Result<Vec<SearchFilter>, serde_json::Error> =
                serde_json::from_str(arg_filters.as_str());
            match filter_conf {
                Ok(conf) => {
                    let mut this = cx.this();
                    let error: Option<String> = {
                        let guard = cx.lock();
                        let mut this_mut = this.borrow_mut(&guard);
                        this_mut.filters.clear();
                        for filter in conf {
                            this_mut.filters.push(filter);
                        }
                        let (shutdown_rx, search_metadata_tx) =
                            (this_mut.shutdown_channel.1.clone(),
                             this_mut.search_metadata_channel.0.clone());
                        let progress_tx = this_mut.start_listening_for_progress(operation_uuid);
                        let search_holder = SearchHolder::new(Path::new(&f), this_mut.filters.iter());
                        thread::spawn(move || {
                            log::debug!("Created rust thread for task execution");
                            match search_holder.execute_search() {
                                Ok((out_path, match_count))=> {
                                    log::info!("Finished search");
                                    let _ = progress_tx.send(Progress::ticks(match_count, match_count));

                                    log::debug!("Done with search, create metadata for search result file");
                                    match Grabber::create_metadata_for_file(out_path, &progress_tx, Some(shutdown_rx)) {
                                        Ok(metadata)=> {
                                            log::info!("Received metadata for search result file");
                                            let _ = search_metadata_tx.send(Ok(metadata));
                                        } //this_mut.content_grabber.unwrap().metadata = metadata,
                                        Err(e) => {
                                            let e_str = format!("Error creating grabber for file: {}", e);
                                            log::error!("{}", e_str);
                                            let _ = search_metadata_tx.send(Err(ComputationError::Process(e_str)));
                                        }
                                    }


                                } //this_mut.content_grabber.unwrap().metadata = metadata,
                                Err(e) => {
                                    let e_str = format!("Error executing search: {}", e);
                                    log::error!("{}", e_str);
                                    let notification = Notification { severity: Severity::ERROR, content: e_str, line: None};
                                    let _ = progress_tx.send(Progress::Notification(notification));
                                }
                            }
                        });
                        None
                    };
                    match error {
                        Some(e) => cx.throw_error(e),
                        None => Ok(cx.undefined().upcast()),
                    }
                }
                Err(e) => cx.throw_error(format!("{}", e))
            }

                }
            }
        }

        // TODO: not needed, remove
        method clearFilters(mut cx) {
            let mut this = cx.this();
            {
                let guard = cx.lock();
                let mut this_mut = this.borrow_mut(&guard);
                this_mut.filters.clear();
            };
            Ok(cx.undefined().upcast())
        }

        method getFilters(mut cx) {
            let this = cx.this();
            let filters = {
                let guard = cx.lock();
                let session = this.borrow(&guard);
                session.filters.clone()
            };

            match serde_json::to_string(&filters) {
                Ok(js_string) => {
                    Ok(cx.string(js_string).upcast())
                },
                Err(e) => {
                    log::error!("Could not convert SearchFilter: {}", e);
                    cx.throw_error(e.to_string())
                },
            }
        }

        method shutdown(mut cx) {
            // TODO clean up
            let mut this = cx.this();
            let id = {
                let guard = cx.lock();
                let session = this.borrow_mut(&guard);
                foo(&session, &cx);
                session.id.clone()
            };
            let res = send_js_event_cx(&mut cx, CallbackEvent::SessionDestroyed);
            Ok(cx.string(match res {
                Ok(()) => id,
                Err(e) => serde_json::to_string(
                    &GeneralError {
                        severity: Severity::ERROR,
                        message: "Could not send ShutdownDestroyed".to_owned(),
                    }).expect("Serialization must not fail for GeneralError")
            }).upcast())
        }
    }
}
