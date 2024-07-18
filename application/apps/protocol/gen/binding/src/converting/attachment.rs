use crate::{attachment, types, E};
use prost::Message;
use serde_wasm_bindgen::to_value;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct AttachmentInfo;

#[wasm_bindgen]
impl AttachmentInfo {
    #[wasm_bindgen]
    pub fn decode(buf: &[u8]) -> Result<JsValue, E> {
        let cb_event: types::AttachmentInfo =
            attachment::AttachmentInfo::decode(buf)?.try_into()?;
        Ok(to_value(&cb_event)?)
    }
}
