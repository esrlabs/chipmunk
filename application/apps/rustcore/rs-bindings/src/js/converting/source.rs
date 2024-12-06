use node_bindgen::{
    core::{
        val::{JsEnv, JsObject},
        NjError, TryIntoJs,
    },
    sys::napi_value,
};
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct WrappedSourceDefinition(pub stypes::SourceDefinition);

impl TryIntoJs for WrappedSourceDefinition {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        let mut json = JsObject::new(*js_env, js_env.create_object()?);
        json.set_property("id", js_env.create_int32(self.0.id as i32)?)?;
        json.set_property("alias", js_env.create_string_utf8(&self.0.alias)?)?;
        json.try_to_js(js_env)
    }
}
