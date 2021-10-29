use crate::js::events::{
    CallbackEvent, ComputationError, NativeError, NativeErrorKind, OperationDone,
};
use indexer_base::progress::Severity;
use log::{debug, trace, warn};
use serde::Serialize;
use std::collections::HashMap;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Debug, Serialize, Clone)]
pub struct NoOperationResults;

pub fn finish<F>(
    uuid: Uuid,
    events: Vec<CallbackEvent>,
    operations: &mut HashMap<Uuid, CancellationToken>,
    callback: &F,
) where
    F: Fn(CallbackEvent) + Send + 'static,
{
    let mut done_event_exists: bool = false;
    for event in events {
        if matches!(event, CallbackEvent::OperationDone(_)) {
            done_event_exists = true;
        }
        callback(event)
    }
    if !done_event_exists {
        // TODO: check is it possible OperationDone is called someone else.
        // somehow we should prevent such situation.
        callback(CallbackEvent::OperationDone(OperationDone {
            uuid,
            result: None,
        }))
    }
    if operations.remove(&uuid).is_none() {
        warn!(
            "Operation {} marked as finished, but operation doesn't exist",
            uuid
        );
    } else {
        debug!("Operation {} has been finished", uuid);
    }
    trace!("Operations in progress: {}", operations.len());
}

pub fn result_to_event<T>(result: Result<T, NativeError>, uuid: Uuid) -> CallbackEvent
where
    T: Serialize,
{
    match result {
        Ok(result) => map_to_event(&result, uuid),
        Err(error) => {
            warn!("Operation {} done with error: {:?}", uuid, error);
            CallbackEvent::OperationError { uuid, error }
        }
    }
}

pub fn err_to_event(result: Result<CallbackEvent, NativeError>, uuid: Uuid) -> CallbackEvent {
    match result {
        Ok(result) => result,
        Err(error) => {
            warn!("Operation {} done with error: {:?}", uuid, error);
            CallbackEvent::OperationError { uuid, error }
        }
    }
}

pub fn map_to_event<T>(v: &T, uuid: Uuid) -> CallbackEvent
where
    T: Serialize,
{
    match serde_json::to_string(v) {
        Ok(serialized) => CallbackEvent::OperationDone(OperationDone {
            uuid,
            result: Some(serialized),
        }),
        Err(err) => CallbackEvent::OperationError {
            uuid,
            error: NativeError {
                severity: Severity::ERROR,
                kind: NativeErrorKind::ComputationFailed,
                message: Some(format!("{}", err)),
            },
        },
    }
}

pub fn uuid_from_str(operation_id: &str) -> Result<Uuid, ComputationError> {
    match Uuid::parse_str(operation_id) {
        Ok(uuid) => Ok(uuid),
        Err(e) => Err(ComputationError::Process(format!(
            "Fail to parse operation uuid from {}. Error: {}",
            operation_id, e
        ))),
    }
}
