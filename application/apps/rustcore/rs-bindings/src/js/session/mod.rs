pub mod events;

use crate::{
    js::{
        converting::{filter::WrappedSearchFilter, source::WrappedSourceDefinition},
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
    factory::ObserveOptions,
    operations,
    session::Session,
};
use std::{convert::TryFrom, ops::RangeInclusive, path::PathBuf, thread};
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
            ComputationError::Process(format!("Could not start tokio runtime: {e}"))
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
    async fn details(&self, _index: i64) -> Result<String, ComputationErrorWrapper> {
        todo!("nyi");
        // Log
    }

    #[node_bindgen]
    async fn export(
        &self,
        out_path: String,
        ranges: Vec<(i64, i64)>,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .export(
                    operations::uuid_from_str(&operation_id)?,
                    PathBuf::from(out_path),
                    ranges
                        .iter()
                        .map(|(s, e)| RangeInclusive::<u64>::new(*s as u64, *e as u64))
                        .collect::<Vec<RangeInclusive<u64>>>(),
                )
                .map_err(ComputationErrorWrapper)?;
            Ok(())
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn export_raw(
        &self,
        out_path: String,
        ranges: Vec<(i64, i64)>,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .export_raw(
                    operations::uuid_from_str(&operation_id)?,
                    PathBuf::from(out_path),
                    ranges
                        .iter()
                        .map(|(s, e)| RangeInclusive::<u64>::new(*s as u64, *e as u64))
                        .collect::<Vec<RangeInclusive<u64>>>(),
                )
                .map_err(ComputationErrorWrapper)?;
            Ok(())
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn is_raw_export_available(&self) -> Result<bool, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .is_raw_export_available()
                .await
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
        let start = u64::try_from(start_line_index)
            .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?;
        let end = u64::try_from(start_line_index + number_of_lines - 1)
            .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?;
        if let Some(ref session) = self.session {
            let grabbed = session
                .grab(LineRange::from(start..=end))
                .await
                .map_err(ComputationErrorWrapper)?;
            Ok(serde_json::to_string(&grabbed)?)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn grab_indexed(
        &self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationErrorWrapper> {
        let start = u64::try_from(start_line_index)
            .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?;
        let end = u64::try_from(start_line_index + number_of_lines - 1)
            .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?;
        if let Some(ref session) = self.session {
            let grabbed = session
                .grab_indexed(RangeInclusive::<u64>::new(start, end))
                .await
                .map_err(ComputationErrorWrapper)?;
            Ok(serde_json::to_string(&grabbed)?)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn set_indexing_mode(&self, mode: i32) -> Result<(), ComputationErrorWrapper> {
        let mode = u8::try_from(mode)
            .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?;
        if let Some(ref session) = self.session {
            session
                .set_indexing_mode(mode)
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
    async fn get_indexed_len(&self) -> Result<i64, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .get_indexed_len()
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
    async fn get_around_indexes(
        &self,
        position: i64,
    ) -> Result<(Option<i64>, Option<i64>), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .get_around_indexes(position as u64)
                .await
                .map(|(b, a)| (b.map(|p| p as i64), a.map(|p| p as i64)))
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn add_bookmark(&self, row: i64) -> Result<(), ComputationErrorWrapper> {
        let row = u64::try_from(row)
            .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?;
        if let Some(ref session) = self.session {
            session
                .add_bookmark(row)
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
    async fn set_bookmarks(&self, rows: Vec<i64>) -> Result<(), ComputationErrorWrapper> {
        let mut converted: Vec<u64> = vec![];
        for row in rows.iter() {
            converted.push(
                u64::try_from(*row)
                    .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?,
            );
        }
        if let Some(ref session) = self.session {
            session
                .set_bookmarks(converted)
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
    async fn remove_bookmark(&self, row: i64) -> Result<(), ComputationErrorWrapper> {
        let row = u64::try_from(row)
            .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?;
        if let Some(ref session) = self.session {
            session
                .remove_bookmark(row)
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
    async fn expand_breadcrumbs(
        &self,
        seporator: i64,
        offset: i64,
        above: bool,
    ) -> Result<(), ComputationErrorWrapper> {
        let seporator = u64::try_from(seporator)
            .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?;
        let offset = u64::try_from(offset)
            .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?;
        if let Some(ref session) = self.session {
            session
                .expand_breadcrumbs(seporator, offset, above)
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
    async fn grab_search(
        &self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationErrorWrapper> {
        let start = u64::try_from(start_line_index)
            .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?;
        let end = u64::try_from(start_line_index + number_of_lines - 1)
            .map_err(|_| ComputationErrorWrapper(ComputationError::InvalidData))?;
        if let Some(ref session) = self.session {
            let grabbed = session
                .grab_search(LineRange::from(start..=end))
                .await
                .map_err(ComputationErrorWrapper)?;
            Ok(serde_json::to_string(&grabbed)?)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn grab_ranges(
        &self,
        ranges: Vec<(i64, i64)>,
    ) -> Result<String, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            let grabbed = session
                .grab_ranges(
                    ranges
                        .iter()
                        .map(|(s, e)| RangeInclusive::<u64>::new(*s as u64, *e as u64))
                        .collect::<Vec<RangeInclusive<u64>>>(),
                )
                .await
                .map_err(ComputationErrorWrapper)?;
            Ok(serde_json::to_string(&grabbed)?)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn observe(
        &self,
        options: String,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        let options: ObserveOptions = serde_json::from_str(&options)
            .map_err(|e| ComputationError::Process(format!("Cannot parse source settings: {e}")))?;
        if let Some(ref session) = self.session {
            session
                .observe(operations::uuid_from_str(&operation_id)?, options)
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
    async fn apply_search_values_filters(
        &self,
        filters: Vec<String>,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            info!(
                target: targets::SESSION,
                "Search values (operation: {}) will be done withing next filters: {:?}",
                operation_id,
                filters
            );
            session
                .apply_search_values_filters(operations::uuid_from_str(&operation_id)?, filters)
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn drop_search(&self) -> Result<bool, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session.drop_search().await.map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
    }

    #[node_bindgen]
    async fn get_sources_definitions(
        &self,
    ) -> Result<Vec<WrappedSourceDefinition>, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            Ok(session
                .get_sources()
                .await
                .map_err(ComputationErrorWrapper)?
                .iter()
                .map(|s| WrappedSourceDefinition(s.clone()))
                .collect::<Vec<WrappedSourceDefinition>>())
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
    async fn send_into_sde(
        &self,
        target: String,
        msg: String,
    ) -> Result<String, ComputationErrorWrapper> {
        if let Some(ref session) = self.session {
            session
                .send_into_sde(operations::uuid_from_str(&target)?, msg)
                .await
                .map_err(ComputationErrorWrapper)
        } else {
            Err(ComputationErrorWrapper(
                ComputationError::SessionUnavailable,
            ))
        }
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
                .tracker
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
