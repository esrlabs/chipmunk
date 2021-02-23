use crate::js::events::SyncChannel;
use crate::js::events::{AsyncBroadcastChannel, AsyncChannel};
use crate::js::events::{CallbackEvent, ComputationError};
use crossbeam_channel as cc;
// use crate::logging::init_logging;
use indexer_base::progress::Severity;
use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    derive::node_bindgen,
    sys::napi_value,
};
use processor::grabber::LineRange;
use processor::grabber::{GrabMetadata, Grabber};
use processor::search::SearchFilter;
use serde::Serialize;
use std::path::Path;
// use std::sync::{Arc, Mutex};
use std::thread;
use tokio::runtime::Runtime;
use tokio::sync::{broadcast, mpsc};
// use tokio_stream::{wrappers::ReceiverStream, StreamExt};
use uuid::Uuid;

pub struct SessionState {
    pub assigned_file: Option<String>,
    pub filters: Vec<SearchFilter>,
}

#[derive(Debug, Serialize, Clone)]
enum Operation {
    Assign {
        file_path: String,
        source_id: String,
        operation_id: Uuid,
    },
    End,
}

pub struct RustSession {
    pub id: String,
    pub running: bool,
    pub content_grabber: Option<Grabber>,
    pub search_grabber: Option<Grabber>,
    // pub state: Arc<Mutex<SessionState>>,
    callback: Option<Box<dyn Fn(CallbackEvent) + Send + 'static>>,

    op_channel: AsyncBroadcastChannel<Operation>,
    // channel that allows to propagate shutdown requests to ongoing operations
    shutdown_channel: AsyncBroadcastChannel<()>,
    // channel to store the metadata of a file once available
    metadata_channel: SyncChannel<Result<Option<GrabMetadata>, ComputationError>>,
    // channel to store the metadata of the search results once available
    search_metadata_channel: AsyncChannel<Result<Option<GrabMetadata>, ComputationError>>,
}

impl RustSession {
    /// will result in a grabber that has it's metadata generated
    /// this function will first check if there has been some new metadata that was previously
    /// written to the metadata-channel. If so, this metadata is used in the grabber.
    /// If there was no new metadata, we make sure that the metadata has been set.
    /// If no metadata is available, an error is returned. That means that assign was not completed before.
    fn get_loaded_grabber(&mut self) -> Result<&mut Grabber, ComputationError> {
        let current_grabber: &mut processor::grabber::Grabber = match &mut self.content_grabber {
            Some(c) => Ok(c),
            None => Err(ComputationError::Protocol(
                "Need a grabber first to work with metadata".to_owned(),
            )),
        }?;
        let fresh_metadata_result = match self.metadata_channel.1.try_recv() {
            Ok(new_metadata) => {
                println!("RUST: new metadata arrived");
                Ok(Some(new_metadata))
            }
            Err(cc::TryRecvError::Empty) => {
                println!("RUST: no new metadata arrived");
                Ok(None)
            }
            Err(cc::TryRecvError::Disconnected) => Err(ComputationError::Protocol(
                "Metadata channel was disconnected".to_owned(),
            )),
        };
        let grabber = match fresh_metadata_result {
            Ok(Some(res)) => {
                println!("RUST: Trying to use new results");
                match res {
                    Ok(Some(metadata)) => {
                        println!("RUST: setting new metadata into content_grabber");
                        current_grabber.metadata = Some(metadata);
                        Ok(current_grabber)
                    }
                    Ok(None) => Err(ComputationError::Process(
                        "No metadata available".to_owned(),
                    )),
                    Err(e) => Err(ComputationError::Protocol(format!(
                        "Problems during metadata generation: {}",
                        e
                    ))),
                }
            }
            Ok(None) => match current_grabber.metadata {
                Some(_) => {
                    println!("RUST: reusing cached metadata");
                    Ok(current_grabber)
                }
                None => Err(ComputationError::Protocol(
                    "No metadata available for grabber".to_owned(),
                )),
            },
            Err(e) => Err(e),
        }?;
        Ok(grabber)
    }
}

enum GrabberKind {
    Content,
    Search,
}

#[node_bindgen]
impl RustSession {
    #[node_bindgen(constructor)]
    pub fn new(id: String) -> Self {
        // init_logging();
        Self {
            id,
            running: false,
            // state: Arc::new(Mutex::new(SessionState {
            //     assigned_file: None,
            //     filters: vec![],
            // })),
            content_grabber: None,
            callback: None,
            search_grabber: None,
            shutdown_channel: broadcast::channel(1),
            op_channel: broadcast::channel(10),
            metadata_channel: cc::bounded(1),
            search_metadata_channel: mpsc::channel(1),
        }
    }

    #[node_bindgen(getter)]
    fn id(&self) -> String {
        println!("value");
        self.id.clone()
    }

    #[node_bindgen]
    fn cancel_operations(&mut self) {
        let _ = self.shutdown_channel.0.send(());
    }

    #[node_bindgen(mt)]
    fn start<F: Fn(CallbackEvent) + Send + 'static>(
        &mut self,
        callback: F,
    ) -> Result<(), ComputationError> {
        // self.callback = Some(Box::new(callback));
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {}", e))
        })?;
        let mut event_stream = self.op_channel.0.subscribe();
        self.running = true;
        let shutdown_tx = self.shutdown_channel.0.clone();
        let metadata_tx = self.metadata_channel.0.clone();
        thread::spawn(move || {
            rt.block_on(async {
                println!("RUST: running runtime");
                loop {
                    match event_stream.recv().await {
                        Ok(op_event) => match op_event {
                            Operation::Assign {
                                file_path,
                                source_id,
                                operation_id,
                            } => {
                                println!("RUST: received Assign operation event");

                                match Grabber::create_metadata_async(
                                    file_path,
                                    Some(shutdown_tx.subscribe()),
                                )
                                .await
                                {
                                    Ok(metadata) => {
                                        println!("RUST: received metadata");
                                        let _ = metadata_tx.send(Ok(metadata));
                                    }
                                    Err(e) => {
                                        println!("RUST error computing metadata");
                                        let _ = metadata_tx.send(Err(ComputationError::Process(
                                            format!("Could not compute metadata: {}", e),
                                        )));
                                    }
                                }
                                callback(CallbackEvent::OperationDone(operation_id));
                            }
                            Operation::End => {
                                println!("RUST: received End operation event");
                                callback(CallbackEvent::SessionDestroyed);
                                break;
                            }
                        },
                        Err(e) => {
                            println!("Rust: error on channel: {}", e);
                            break;
                        }
                    }
                }
                println!("RUST: exiting runtime");
            })
        });
        Ok(())
    }

    #[node_bindgen]
    fn get_stream_len(&mut self) -> Result<i64, ComputationError> {
        match &self.get_loaded_grabber()?.metadata {
            Some(md) => Ok(md.line_count as i64),
            None => Err(ComputationError::Protocol("Cannot happen".to_owned())),
        }
    }

    #[node_bindgen]
    fn grab(
        &mut self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationError> {
        let grabbed_content = self
            .get_loaded_grabber()?
            .get_entries(&LineRange::new(
                start_line_index as u64,
                (start_line_index + number_of_lines) as u64,
            ))
            .map_err(|e| ComputationError::Communication(format!("{}", e)))?;
        let serialized =
            serde_json::to_string(&grabbed_content).map_err(|_| ComputationError::InvalidData)?;

        Ok(serialized)
    }

    #[node_bindgen]
    fn stop(&mut self) -> Result<(), ComputationError> {
        let _ = self.op_channel.0.send(Operation::End);
        self.running = false;
        Ok(())
    }

    #[node_bindgen]
    fn assign(&mut self, file_path: String, source_id: String) -> Result<String, ComputationError> {
        println!("RUST: send assign event on channel");
        let operation_id = Uuid::new_v4();

        let grabber = Grabber::new(Path::new(&file_path), &source_id)
            .map_err(|e| ComputationError::Process(format!("Could not create grabber: {}", e)))?;
        self.content_grabber = Some(grabber);
        self.op_channel
            .0
            .send(Operation::Assign {
                file_path,
                source_id,
                operation_id,
            })
            .map_err(|_| {
                ComputationError::Process("Could not send operation on channel".to_string())
            })?;
        Ok(operation_id.to_string())
    }
}

// TODO:
//         method grab_search_results(mut cx) {
//         method setFilters(mut cx) {
//         method getFilters(mut cx) {
//         method shutdown(mut cx) {

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GeneralError {
    severity: Severity,
    message: String,
}

impl TryIntoJs for CallbackEvent {
    /// serialize into json object
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        // create JSON

        match serde_json::to_string(&self) {
            Ok(s) => js_env.create_string_utf8(&s),
            Err(e) => Err(NjError::Other(format!(
                "Could not convert Callback event to json: {}",
                e
            ))),
        }
        // json.set_property("value", js_env.create_string_utf8(&s)?);
        // json.try_to_js(js_env)
    }
}
// impl JSValue<'_> for CallbackEvent {
// fn convert_to_rust(env: &JsEnv, n_value: napi_value) -> Result<Self, NjError> {
//     // check if it is integer
//     if let Ok(js_obj) = env.convert_to_rust::<JsObject>(n_value) {
//         if let Some(val_property) = js_obj.get_property("signature")? {
//             let signature = val_property.as_value::<String>()?;
//             match signature.as_str() {
//                 "StreamUpdated" => {
//                     let mut data = StreamUpdated::default();
//                     if let Some(val_property) = js_obj.get_property("bytes")? {
//                         data.bytes = val_property.as_value::<i32>()?;
//                     } else {
//                         return Err(NjError::Other("bytes is not found".to_owned()));
//                     }
//                     if let Some(val_property) = js_obj.get_property("rows")? {
//                         data.rows = val_property.as_value::<i32>()?;
//                     } else {
//                         return Err(NjError::Other("rows is not found".to_owned()));
//                     }
//                     Ok(Self::StreamUpdated(data))
//                 }
//                 "SearchUpdated" => {
//                     let mut data = SearchUpdated::default();
//                     if let Some(val_property) = js_obj.get_property("bytes")? {
//                         data.bytes = val_property.as_value::<i32>()?;
//                     } else {
//                         return Err(NjError::Other("bytes is not found".to_owned()));
//                     }
//                     if let Some(val_property) = js_obj.get_property("rows")? {
//                         data.rows = val_property.as_value::<i32>()?;
//                     } else {
//                         return Err(NjError::Other("rows is not found".to_owned()));
//                     }
//                     if let Some(val_property) = js_obj.get_property("done")? {
//                         data.done = val_property.as_value::<f64>()?;
//                     } else {
//                         return Err(NjError::Other("done is not found".to_owned()));
//                     }
//                     Ok(Self::SearchUpdated(data))
//                 }
//                 _ => Err(NjError::Other("Unknown event has been gotten".to_owned())),
//             }
//         } else {
//             Err(NjError::Other("Fail to find event signature".to_owned()))
//         }
//     } else {
//         Err(NjError::Other("not valid format".to_owned()))
//     }
// }
// }
