use thiserror::Error;
use wasm_bindgen::JsValue;

#[derive(Error, Debug)]
pub enum E {
    #[error("Missed field {0}")]
    MissedField(String),
    #[error("Invalid value of: {0}")]
    InvalidValue(String),
    #[error("Codec decode error: {0}")]
    CodecDecodeError(String),
    #[error("Codec encode error: {0}")]
    CodecEncodeError(String),
    #[error("Decode error: {0}")]
    DecodeError(String),
    #[error("Encode error: {0}")]
    EncodeError(String),
    #[error("Binding error: {0}")]
    Binding(serde_wasm_bindgen::Error),
    #[error("Not yet implemented feature")]
    NotImplemented,
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
