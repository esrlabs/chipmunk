use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use session::events::LifecycleTransition;

#[derive(Debug)]
pub(crate) struct LifecycleTransitionWrapper(pub LifecycleTransition);

impl TryIntoJs for LifecycleTransitionWrapper {
    /// serialize into json object
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        match serde_json::to_string(&self.0) {
            Ok(s) => js_env.create_string_utf8(&s),
            Err(e) => Err(NjError::Other(format!(
                "Could not convert Callback event to json: {e}"
            ))),
        }
    }
}
