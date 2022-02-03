use node_bindgen::{
    core::{
        val::{JsEnv, JsObject},
        JSValue, NjError,
    },
    sys::napi_value,
};
use serde::Serialize;
use session::factory::{ParserType, Source};
use std::path::PathBuf;

#[derive(Serialize, Debug, Clone)]
pub struct WrappedSource(Source);

impl WrappedSource {
    pub fn get_source(&self) -> Source {
        self.0.clone()
    }
}

impl JSValue<'_> for WrappedSource {
    fn convert_to_rust(env: &JsEnv, n_value: napi_value) -> Result<Self, NjError> {
        if let Ok(js_obj) = env.convert_to_rust::<JsObject>(n_value) {
            let filename: String = match js_obj.get_property("filename") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other(
                        "[filename] property is not found".to_owned(),
                    ));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            let parser: String = match js_obj.get_property("parser") {
                Ok(Some(value)) => value.as_value()?,
                Ok(None) => {
                    return Err(NjError::Other("[parser] property is not found".to_owned()));
                }
                Err(e) => {
                    return Err(e);
                }
            };
            Ok(WrappedSource(Source::File(
                PathBuf::from(filename),
                match parser.as_str() {
                    "text" => ParserType::Text,
                    "pcap" => ParserType::Pcap,
                    "dlt" => ParserType::Dlt,
                    _ => ParserType::Text,
                },
            )))
        } else {
            Err(NjError::Other("not valid format".to_owned()))
        }
    }
}
