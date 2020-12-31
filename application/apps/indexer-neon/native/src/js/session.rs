use crate::js::events::Channel;
use crate::js::events::{CallbackEvent, ComputationError, Done};
use crossbeam_channel as cc;
use indexer_base::progress::Progress;
use neon::prelude::*;
use processor::grabber::GrabbedContent;
use processor::grabber::LineRange;
use processor::grabber::{GrabMetadata, Grabber};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::thread;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SearchFilter {
    value: String,
    is_regex: bool,
    case_sensitive: bool,
    is_word: bool,
}

pub struct RustSession {
    pub id: String,
    pub assigned_file: Option<String>,
    pub content_grabber: Option<Grabber>,
    pub(crate) handler: EventHandler,
    pub filters: Vec<SearchFilter>,
    // channel that allows to propagate shutdown requests to ongoing operations
    shutdown_channel: Channel<()>,
    // channel to store the metadata of a file once available
    metadata_channel: Channel<Result<Option<GrabMetadata>, ComputationError>>,
}

impl RustSession {
    pub fn start_listening_for_metadata_progress(
        &self,
        javascript_listener: neon::event::EventHandler,
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
                        if let Err(e) =
                            send_js_event(&javascript_listener, CallbackEvent::Progress(progress))
                        {
                            log::warn!("Could not send event to js: {}", e);
                        }
                        if operation_done {
                            log::debug!("Stop listening for metadata");
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

    fn grab_lines(
        &mut self,
        start_line_index: u64,
        number_of_lines: u64,
    ) -> Result<GrabbedContent, ComputationError> {
        match &mut self.content_grabber {
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
    javascript_listener: &neon::event::EventHandler,
    event: T,
) -> Result<(), ComputationError> {
    match serde_json::to_string(&event) {
        Ok(js_string) => {
            javascript_listener.schedule_with(move |cx, this, callback| {
                let args: Vec<Handle<JsValue>> = vec![cx.string(js_string).upcast()];
                if let Err(e) = callback.call(cx, this, args) {
                    log::error!("Error on calling js callback: {}", e);
                }
            });
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Could not convert Event: {}", e);
            log::error!("{}", &error_msg);
            Err(ComputationError::InvalidData)
        }
    }
}

fn send_js_event_cx<'a, T: Serialize>(
    cx: &mut neon::context::CallContext<'a, JsRustSession>,
    event: T,
) -> Result<(), neon::result::Throw> {
    let error = {
        let this = cx.this();
        let guard = cx.lock();
        let this = this.borrow(&guard);
        let handler = this.handler.clone();
        match send_js_event(&handler, event) {
            Err(e) => Some(format!("{}", e)),
            Ok(()) => None,
        }
    };
    match error {
        Some(e) => cx.throw_error(e),
        None => Ok(()),
    }
}

declare_types! {

    pub class JsRustSession for RustSession {
        init(mut cx) {
            let id = cx.argument::<JsString>(0)?.value();
            let callback = cx.argument::<JsFunction>(1)?;
            let this = cx.this();
            let handler = EventHandler::new(&cx, this, callback);
            Ok(RustSession {
                id,
                handler,
                assigned_file: None,
                content_grabber: None,
                filters: vec![],
                shutdown_channel: cc::unbounded(),
                metadata_channel: cc::unbounded(),
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
            let file_path = cx.argument::<JsString>(0)?.value();
            let source_id = cx.argument::<JsString>(1)?.value();
            let mut this = cx.this();
            let error = {
                let guard = cx.lock();
                let mut this_mut = this.borrow_mut(&guard);
                this_mut.assigned_file = Some(file_path.clone());
                match Grabber::lazy(Path::new(&file_path), &source_id) {
                    Ok(grabber) => {
                        this_mut.content_grabber = Some(grabber);
                        let (handler, shutdown_rx, metadata_tx) =
                            (this_mut.handler.clone(),
                             this_mut.shutdown_channel.1.clone(),
                             this_mut.metadata_channel.0.clone());
                        let progress_tx = this_mut.start_listening_for_metadata_progress(handler);
                        thread::spawn(move || {
                            log::debug!("Created rust thread for task execution");
                            match Grabber::create_metadata_for_file(file_path, &progress_tx, Some(shutdown_rx)) {
                                Ok(metadata)=> {
                                    log::info!("received metadata");
                                    let _ = metadata_tx.send(Ok(metadata));
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
                None => Ok(cx.undefined().upcast()),
            }
        }

        method grab(mut cx) {
            let start_line_index: u64 = cx.argument::<JsNumber>(0)?.value() as u64;
            let number_of_lines: u64 = cx.argument::<JsNumber>(1)?.value() as u64;
            let mut this = cx.this();
            let error = {
                let guard = cx.lock();
                let mut this_mut = this.borrow_mut(&guard);
                this_mut.grab_lines(start_line_index, number_of_lines)
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
            let arg_filters = cx.argument::<JsString>(0)?.value();
            let filter_conf: Result<Vec<SearchFilter>, serde_json::Error> =
                serde_json::from_str(arg_filters.as_str());
            match filter_conf {
                Ok(conf) => {
                    let mut this = cx.this();
                    {
                        let guard = cx.lock();
                        let mut this_mut = this.borrow_mut(&guard);
                        this_mut.filters.clear();
                        for filter in conf {
                            this_mut.filters.push(filter);
                        }
                    };
                    Ok(cx.undefined().upcast())
                }
                Err(e) => cx.throw_error(format!("{}", e))
            }
        }

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
            send_js_event_cx(&mut cx, CallbackEvent::Done(Done::Finished))?;
            Ok(cx.undefined().upcast())
        }
    }
}
