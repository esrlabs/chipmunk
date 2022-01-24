pub mod events;

use crate::{
    js::{
        converting::{
            concat::WrappedConcatenatorInput, filter::WrappedSearchFilter,
            merge::WrappedFileMergeOptions,
        },
        session::events::ComputationErrorWrapper,
    },
    logging::targets,
};
use events::CallbackEventWrapper;
use log::{debug, error, info, warn};
use node_bindgen::derive::node_bindgen;
use processor::grabber::LineRange;
use session::{
    events::{CallbackEvent, ComputationError, NativeError},
    operations,
    session::Session,
};
use std::{path::PathBuf, thread};
use tokio::{runtime::Runtime, sync::oneshot};
use uuid::Uuid;

struct RustSession {
    session: Option<Session>,
    uuid: Uuid,
}

#[node_bindgen]
impl RustSession {
    #[node_bindgen(constructor)]
    pub fn new(id: String) -> Self {
        let uuid = match operations::uuid_from_str(&id) {
            Ok(uuid) => uuid,
            Err(err) => {
                // TODO: Should be replaced with error
                panic!("Fail to convert UUID = {}; error:{}", id, err);
            }
        };
        Self {
            session: None,
            uuid,
        }
    }

    #[node_bindgen(mt)]
    async fn init<F: Fn(CallbackEventWrapper) + Send + 'static>(
        &mut self,
        callback: F,
    ) -> Result<(), ComputationErrorWrapper> {
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {}", e))
        })?;
        let (tx_session, rx_session): (oneshot::Sender<Session>, oneshot::Receiver<Session>) =
            oneshot::channel();
        let uuid = self.uuid;
        thread::spawn(move || {
            rt.block_on(async {
                let (session, mut rx_callback_events) = Session::new(uuid).await;
                if tx_session.send(session).is_err() {
                    error!("Cannot setup session instance");
                    return;
                }
                debug!("task is started");
                while let Some(event) = rx_callback_events.recv().await {
                    callback(event.into())
                }
                debug!("sending SessionDestroyed event");
                callback(CallbackEvent::SessionDestroyed.into());
                debug!("task is finished");
            })
        });
        self.session = Some(rx_session.await.map_err(|_| {
            ComputationErrorWrapper(ComputationError::Communication(String::from(
                "Fail to get session instance to setup",
            )))
        })?);
        Ok(())
    }

    #[node_bindgen]
    fn get_uuid(&self) -> Result<String, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            Ok(session.get_uuid().to_string())
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    fn abort(
        &self,
        operation_id: String,
        target_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .abort(
                    operations::uuid_from_str(&operation_id)?,
                    operations::uuid_from_str(&target_id)?,
                )
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn stop(&self, operation_id: String) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .stop(operations::uuid_from_str(&operation_id)?)
                .await
                .map_err(ComputationErrorWrapper)?;
            Ok(())
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn get_stream_len(&self) -> Result<i64, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .get_stream_len()
                .await
                .map(|r| r as i64)
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn get_search_len(&self) -> Result<i64, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .get_search_result_len()
                .await
                .map(|r| r as i64)
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn grab(
        &self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            let grabbed = session
                .grab(LineRange::from(
                    (start_line_index as u64)..=((start_line_index + number_of_lines - 1) as u64),
                ))
                .await
                .map_err(ComputationErrorWrapper)?;
            Ok(serde_json::to_string(&grabbed).map_err(|_| ComputationError::InvalidData)?)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn grab_search(
        &self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            let grabbed = session
                .grab_search(LineRange::from(
                    (start_line_index as u64)..=((start_line_index + number_of_lines - 1) as u64),
                ))
                .await
                .map_err(ComputationErrorWrapper)?;
            Ok(serde_json::to_string(&grabbed).map_err(|_| ComputationError::InvalidData)?)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn assign(
        &self,
        file_path: String,
        _source_id: String,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .assign(
                    operations::uuid_from_str(&operation_id)?,
                    PathBuf::from(file_path),
                )
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn apply_search_filters(
        &self,
        filters: Vec<WrappedSearchFilter>,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            info!(
                target: targets::SESSION,
                "Search (operation: {}) will be done withing next filters: {:?}",
                operation_id,
                filters
            );
            session
                .apply_search_filters(
                    operations::uuid_from_str(&operation_id)?,
                    filters.iter().map(|f| f.as_filter()).collect(),
                )
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn extract_matches(
        &self,
        filters: Vec<WrappedSearchFilter>,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            info!(
                target: targets::SESSION,
                "Extract (operation: {}) will be done withing next filters: {:?}",
                operation_id,
                filters
            );
            session
                .extract_matches(
                    operations::uuid_from_str(&operation_id)?,
                    filters.iter().map(|f| f.as_filter()).collect(),
                )
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn get_map(
        &self,
        operation_id: String,
        dataset_len: i32,
        from: Option<i64>,
        to: Option<i64>,
    ) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            let mut range: Option<(u64, u64)> = None;
            if let Some(from) = from {
                if let Some(to) = to {
                    if from >= 0 && to >= 0 {
                        if from <= to {
                            range = Some((from as u64, to as u64));
                        } else {
                            warn!(
                                target: targets::SESSION,
                                "Invalid range (operation: {}): from = {}; to = {}",
                                operation_id,
                                from,
                                to
                            );
                        }
                    }
                }
            }
            info!(
                target: targets::SESSION,
                "Map requested (operation: {}). Range: {:?}", operation_id, range
            );
            session
                .get_map(
                    operations::uuid_from_str(&operation_id)?,
                    dataset_len as u16,
                    range,
                )
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn get_nearest_to(
        &self,
        operation_id: String,
        position_in_stream: i64,
    ) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .get_nearest_to(
                    operations::uuid_from_str(&operation_id)?,
                    position_in_stream as u64,
                )
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn concat(
        &self,
        _files: Vec<WrappedConcatenatorInput>,
        _append: bool,
        _operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        // if !self.0.is_opened() {
        //     return Err(ComputationError::SessionUnavailable.into());
        // }
        // //TODO: out_path should be gererics by some settings.
        // let (out_path, out_path_str) = if files.is_empty() {
        //     return Err(ComputationError::InvalidData.into());
        // } else {
        //     let filename = PathBuf::from(&files[0].as_concatenator_input().path);
        //     if let Some(parent) = filename.parent() {
        //         if let Some(file_name) = filename.file_name() {
        //             let path = parent.join(format!("{}.concat", file_name.to_string_lossy()));
        //             (path.clone(), path.to_string_lossy().to_string())
        //         } else {
        //             return Err(ComputationError::InvalidData.into());
        //         }
        //     } else {
        //         return Err(ComputationError::InvalidData.into());
        //     }
        // };
        // let _ = OpenOptions::new()
        //     .read(true)
        //     .write(true)
        //     .create(true)
        //     .open(&out_path)
        //     .map_err(|_| {
        //         ComputationError::IoOperation(format!(
        //             "Could not create/open file {}",
        //             &out_path_str
        //         ))
        //     })?;
        // let boxed_grabber =
        //     create_lazy_grabber(&out_path, &out_path_str).map_err(ComputationError::from)?;
        // self.0.content_grabber = Some(boxed_grabber);
        // match self.0.tx_operations.send((
        //     operations::uuid_from_str(&operation_id)?,
        //     operations::Operation::Concat {
        //         files: files
        //             .iter()
        //             .map(|file| file.as_concatenator_input())
        //             .collect(),
        //         out_path,
        //         append,
        //         source_id: out_path_str,
        //     },
        // )) {
        //     Ok(_) => Ok(()),
        //     Err(e) => Err(ComputationError::Process(format!(
        //         "Could not send operation on channel. Error: {}",
        //         e
        //     ))
        //     .into()),
        // }
        Ok(())
    }

    #[node_bindgen]
    async fn merge(
        &self,
        _files: Vec<WrappedFileMergeOptions>,
        _append: bool,
        _operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        // if !self.0.is_opened() {
        //     return Err(ComputationError::SessionUnavailable.into());
        // }
        // //TODO: out_path should be gererics by some settings.
        // let (out_path, out_path_str) = if files.is_empty() {
        //     return Err(ComputationError::InvalidData.into());
        // } else {
        //     let filename = PathBuf::from(&files[0].as_file_merge_options().path);
        //     if let Some(parent) = filename.parent() {
        //         if let Some(file_name) = filename.file_name() {
        //             let path = parent.join(format!("{}.merged", file_name.to_string_lossy()));
        //             (path.clone(), path.to_string_lossy().to_string())
        //         } else {
        //             return Err(ComputationError::InvalidData.into());
        //         }
        //     } else {
        //         return Err(ComputationError::InvalidData.into());
        //     }
        // };
        // let _ = OpenOptions::new()
        //     .read(true)
        //     .write(true)
        //     .create(true)
        //     .open(&out_path)
        //     .map_err(|_| {
        //         ComputationError::IoOperation(format!(
        //             "Could not create/open file {}",
        //             &out_path_str
        //         ))
        //     })?;
        // let boxed_grabber =
        //     create_lazy_grabber(&out_path, &out_path_str).map_err(ComputationError::from)?;
        // self.0.content_grabber = Some(boxed_grabber);
        // match self.0.tx_operations.send((
        //     operations::uuid_from_str(&operation_id)?,
        //     operations::Operation::Merge {
        //         files: files
        //             .iter()
        //             .map(|file| file.as_file_merge_options())
        //             .collect(),
        //         out_path,
        //         append,
        //         source_id: out_path_str,
        //     },
        // )) {
        //     Ok(_) => Ok(()),
        //     Err(e) => Err(ComputationError::Process(format!(
        //         "Could not send operation on channel. Error: {}",
        //         e
        //     ))
        //     .into()),
        // }
        Ok(())
    }

    #[node_bindgen]
    async fn set_debug(&self, debug: bool) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .state
                .set_debug(debug)
                .await
                .map_err(|e: NativeError| ComputationError::NativeError(e).into())
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn get_operations_stat(&self) -> Result<String, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .state
                .get_operations_stat()
                .await
                .map_err(|e: NativeError| ComputationError::NativeError(e).into())
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn sleep(&self, operation_id: String, ms: i64) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .sleep(operations::uuid_from_str(&operation_id)?, ms as u64)
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }
}
