use node_bindgen::{
    core::{
        val::{JsEnv, JsObject},
        JSValue, NjError,
    },
    sys::napi_value,
};
use processor::search::filter::SearchFilter;
use serde::Serialize;
#[derive(Serialize, Debug, Clone)]
pub struct WrappedSearchFilter(SearchFilter);

impl WrappedSearchFilter {
    pub fn as_filter(&self) -> SearchFilter {
        self.0.clone()
    }
}

impl JSValue<'_> for WrappedSearchFilter {
    fn convert_to_rust(env: &JsEnv, n_value: napi_value) -> Result<Self, NjError> {
        if let Ok(js_obj) = env.convert_to_rust::<JsObject>(n_value) {
            let value: String = match js_obj.get_property("value") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other("[value] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let is_regex: bool = match js_obj.get_property("is_regex") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other(
                        "[is_regex] property is not found".to_owned(),
                    ));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let is_word: bool = match js_obj.get_property("is_word") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other("[is_word] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let ignore_case: bool = match js_obj.get_property("ignore_case") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other(
                        "[ignore_case] property is not found".to_owned(),
                    ));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            Ok(WrappedSearchFilter(SearchFilter {
                value,
                is_regex,
                ignore_case,
                is_word,
            }))
        } else {
            Err(NjError::Other("not valid format".to_owned()))
        }
    }
}
