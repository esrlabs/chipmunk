use crate::{event, types, E};
use prost::Message;
use serde_wasm_bindgen::to_value;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct CallbackEvent;

#[wasm_bindgen]
impl CallbackEvent {
    #[wasm_bindgen]
    pub fn decode(buf: &[u8]) -> Result<JsValue, E> {
        let cb_event: types::CallbackEvent = event::CallbackEvent::decode(buf)?.try_into()?;
        Ok(to_value(&cb_event)?)
    }
}
