use prost::DecodeError;
use thiserror::Error;
use wasm_bindgen::JsValue;

#[derive(Error, Debug)]
pub enum E {
    #[error("Missed field {0}")]
    MissedField(String),
    #[error("Invalid value of: {0}")]
    InvalidValue(String),
    #[error("Decode error: {0}")]
    DecodeError(DecodeError),
    #[error("Binding error: {0}")]
    Binding(serde_wasm_bindgen::Error),
    #[error("Not yet implemented feature")]
    NotImplemented,
}

impl From<DecodeError> for E {
    fn from(err: DecodeError) -> Self {
        Self::DecodeError(err)
    }
}

impl From<serde_wasm_bindgen::Error> for E {
    fn from(err: serde_wasm_bindgen::Error) -> Self {
        Self::Binding(err)
    }
}

impl From<E> for JsValue {
    fn from(val: E) -> Self {
        JsValue::from_str(&val.to_string())
    }
}
