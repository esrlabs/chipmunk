use crate::{sde, types, E};
use prost::Message;
use serde_wasm_bindgen::to_value;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SdeRequest;

#[wasm_bindgen]
impl SdeRequest {
    #[wasm_bindgen]
    pub fn decode(buf: &[u8]) -> Result<JsValue, E> {
        let cb_event: types::SdeRequest = sde::SdeRequest::decode(buf)?.try_into()?;
        Ok(to_value(&cb_event)?)
    }
}

#[wasm_bindgen]
pub struct SdeResponse;

#[wasm_bindgen]
impl SdeResponse {
    #[wasm_bindgen]
    pub fn decode(buf: &[u8]) -> Result<JsValue, E> {
        let cb_event: types::SdeResponse = sde::SdeResponse::decode(buf)?.try_into()?;
        Ok(to_value(&cb_event)?)
    }
}
