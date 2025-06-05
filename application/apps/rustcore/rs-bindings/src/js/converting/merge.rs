use merging::merger::FileMergeOptions;
use node_bindgen::{
    core::{
        JSValue, NjError,
        val::{JsEnv, JsObject},
    },
    sys::napi_value,
};
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct WrappedFileMergeOptions(FileMergeOptions);

// impl WrappedFileMergeOptions {
//     pub fn as_file_merge_options(&self) -> FileMergeOptions {
//         self.0.clone()
//     }
// }

impl JSValue<'_> for WrappedFileMergeOptions {
    fn convert_to_rust(env: &JsEnv, n_value: napi_value) -> Result<Self, NjError> {
        if let Ok(js_obj) = env.convert_to_rust::<JsObject>(n_value) {
            let path: String = match js_obj.get_property("path") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other("[path] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let tag: String = match js_obj.get_property("tag") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other("[tag] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let format: String = match js_obj.get_property("format") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other("[format] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let offset: Option<i64> = match js_obj.get_property("offset") {
                Ok(Some(value)) => Some(value.as_value()?),
                Ok(None) => None,
                Err(e) => {
                    return Err(e);
                }
            };
            let year: Option<i32> = match js_obj.get_property("year") {
                Ok(Some(value)) => Some(value.as_value()?),
                Ok(None) => None,
                Err(e) => {
                    return Err(e);
                }
            };
            Ok(WrappedFileMergeOptions(FileMergeOptions {
                path,
                offset,
                year,
                tag,
                format,
            }))
        } else {
            Err(NjError::Other("not valid format".to_owned()))
        }
    }
}
