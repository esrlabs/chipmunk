use log::debug;
use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use session::events::{CallbackEvent, ComputationError, NativeError};
use tokio::sync::mpsc::UnboundedReceiver;

#[derive(Debug)]
pub(crate) struct CallbackEventWrapper(pub CallbackEvent);

impl TryIntoJs for CallbackEventWrapper {
    /// serialize into json object
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        match serde_json::to_string(&self.0) {
            Ok(s) => js_env.create_string_utf8(&s),
            Err(e) => Err(NjError::Other(format!(
                "Could not convert Callback event to json: {}",
                e
            ))),
        }
    }
}

impl From<CallbackEvent> for CallbackEventWrapper {
    fn from(e: CallbackEvent) -> CallbackEventWrapper {
        CallbackEventWrapper(e)
    }
}

pub(crate) struct ComputationErrorWrapper(pub ComputationError);

impl TryIntoJs for ComputationErrorWrapper {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        let value = serde_json::to_value(&self.0).map_err(|e| NjError::Other(format!("{}", e)))?;
        value.try_to_js(js_env)
    }
}

impl From<ComputationError> for ComputationErrorWrapper {
    fn from(err: ComputationError) -> ComputationErrorWrapper {
        ComputationErrorWrapper(err)
    }
}

pub(crate) async fn callback_event_loop<F: Fn(CallbackEventWrapper) + Send + 'static>(
    callback: F,
    mut rx_callback_events: UnboundedReceiver<CallbackEvent>,
) -> Result<(), NativeError> {
    debug!("task is started");
    while let Some(event) = rx_callback_events.recv().await {
        callback(event.into())
    }
    debug!("sending SessionDestroyed event");
    callback(CallbackEvent::SessionDestroyed.into());
    debug!("task is finished");
    Ok(())
}
