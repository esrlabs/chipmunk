use crate::channels::EventEmitterTask;
use crossbeam_channel as cc;
use indexer_base::progress::{IndexingProgress, IndexingResults};
use neon::prelude::*;
use processor::grabber::GrabMetadata;
use processor::grabber::{Grabber, LineRange};
use std::path::Path;
use std::path::PathBuf;

type Channel<T> = (cc::Sender<T>, cc::Receiver<T>);

pub struct GrabberHolder {
    pub grabber: Grabber,
    pub metadata_channel: Channel<Option<GrabMetadata>>,
    pub event_channel: Channel<IndexingResults<()>>,
    pub shutdown_channel: Channel<()>,
    pub task_thread: Option<std::thread::JoinHandle<()>>,
}
impl GrabberHolder {
    pub fn initialize_metadata_in_thread(
        path: &Path,
        shutdown_rx: cc::Receiver<()>,
        result_sender: cc::Sender<IndexingResults<()>>,
        metadata_sender: cc::Sender<Option<GrabMetadata>>,
    ) {
        let p = PathBuf::from(path);
        std::thread::spawn(move || {
            if let Ok(metadata) =
                Grabber::create_metadata_for_file(p, &result_sender, Some(shutdown_rx))
            {
                let _ = metadata_sender.send(metadata);
            }
            debug!("back after timespan detection finished!",);
        });
    }
}

declare_types! {

    pub class JsGrabber for GrabberHolder {
        init(mut cx) {
            let path: Handle<JsString> = cx.argument::<JsString>(0)?;

            let shutdown_channel = cc::unbounded();
            let chunk_result_channel: (cc::Sender<IndexingResults<()>>, cc::Receiver<IndexingResults<()>>) = cc::unbounded();
            let metadata_channel = cc::unbounded();
            match Grabber::lazy(path.value()) {
                Ok(grabber) => Ok(GrabberHolder {
                    grabber,
                    event_channel: chunk_result_channel,
                    shutdown_channel,
                    metadata_channel,
                    task_thread: None,
                }),
                Err(e) => {
                    cx.throw_error(format!("Error...{}", e))
                }
            }
        }

        method create_metadata_async(mut cx) {
            let mut this = cx.this();
            cx.borrow_mut(&mut this, |grabber_holder| {

                GrabberHolder::initialize_metadata_in_thread(
                    &grabber_holder.grabber.path,
                    grabber_holder.shutdown_channel.1.clone(),
                    grabber_holder.event_channel.0.clone(),
                    grabber_holder.metadata_channel.0.clone(),
                );
            });
            Ok(JsUndefined::new().upcast())
        }

        method grab(mut cx) {
            let start_line_index: u64 = cx.argument::<JsNumber>(0)?.value() as u64;
            let number_of_lines: u64 = cx.argument::<JsNumber>(1)?.value() as u64;
            let this = cx.this();
            let array: Handle<JsArray> = JsArray::new(&mut cx, number_of_lines as u32);
            let r = cx.borrow(&this, |grabber_holder| {
                grabber_holder.grabber.get_entries(&LineRange::new(start_line_index, start_line_index + number_of_lines))
            });

            match r {
                Ok(lines) => {
                    for (i, x) in lines.into_iter().enumerate() {
                        let s = cx.string(x);
                        array.set(&mut cx, i as u32, s)?;
                    }
                    Ok(array.as_value(&mut cx))
                },
                Err(e) => cx.throw_error(format!("Error...{}", e))
            }
        }

        method total_entries(mut cx) {
            let this = cx.this();
            let cnt = cx.borrow(&this, |grabber_holder| {
                match &grabber_holder.grabber.metadata {
                    Some(metadata) => Some(metadata.line_count as f64),
                    None => None,
                }
            });
            let res_array = match cnt {
                Some(c) => {
                    let js_array = JsArray::new(&mut cx, 1u32);
                    let js_nr = cx.number(c);
                    js_array.set(&mut cx, 0u32, js_nr).unwrap();
                    js_array
                }
                None => JsArray::new(&mut cx, 0u32),
            };
            Ok(res_array.as_value(&mut cx))
        }

        method path(mut cx) {
            let this = cx.this();
            let path = cx.borrow(&this, |grabber_holder| {
                grabber_holder.grabber.path.clone()
            });
            Ok(cx.string(&path.to_string_lossy()).upcast())
        }

        method poll(mut cx) {
            let cb = cx.argument::<JsFunction>(0)?;
            let mut this = cx.this();
            cx.borrow_mut(&mut this, |mut grabber_holder| {
                if let Ok(metadata) = grabber_holder.metadata_channel.1.try_recv() {
                    // metadata was created in separate rust thread
                    grabber_holder.grabber.metadata = metadata;
                    // let's tell our listeners that the async creation of metadata finished
                    let _ = grabber_holder.event_channel.0.send(Ok(IndexingProgress::Finished));
                }

                let task = EventEmitterTask::new(grabber_holder.event_channel.1.clone());
                task.schedule(cb);
            });
            Ok(JsUndefined::new().upcast())
        }

        method shutdown(mut cx) {
            let this = cx.this();
            cx.borrow(&this, |grabber_holder| {
                match grabber_holder.shutdown_channel.0.send(()) {
                    Err(e) => warn!("error happened when sending: {}", e),
                    Ok(()) => trace!("sent command Shutdown")
                }
            });
            Ok(JsUndefined::new().upcast())
        }
    }
}
