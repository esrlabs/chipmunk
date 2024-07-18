use crate::*;
use prost::Message;
use serde_wasm_bindgen::to_value;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct NativeError;

#[wasm_bindgen]
impl NativeError {
    #[wasm_bindgen]
    pub fn decode(buf: &[u8]) -> Result<JsValue, E> {
        let cb_event: types::NativeError = error::NativeError::decode(buf)?.try_into()?;
        Ok(to_value(&cb_event)?)
    }
}

#[wasm_bindgen]
pub struct ComputationError;

#[wasm_bindgen]
impl ComputationError {
    #[wasm_bindgen]
    pub fn decode(buf: &[u8]) -> Result<JsValue, E> {
        let cb_event: types::ComputationError = error::ComputationError::decode(buf)?.try_into()?;
        Ok(to_value(&cb_event)?)
    }
}
