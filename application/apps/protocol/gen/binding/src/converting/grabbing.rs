use crate::{grabbing, types, E};
use prost::Message;
use serde_wasm_bindgen::to_value;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct GrabbedElement;

#[wasm_bindgen]
impl GrabbedElement {
    #[wasm_bindgen]
    pub fn decode(buf: &[u8]) -> Result<JsValue, E> {
        let cb_event: types::GrabbedElement = grabbing::GrabbedElement::decode(buf)?.try_into()?;
        Ok(to_value(&cb_event)?)
    }
}

#[wasm_bindgen]
pub struct GrabbedElementList;

#[wasm_bindgen]
impl GrabbedElementList {
    #[wasm_bindgen]
    pub fn decode(buf: &[u8]) -> Result<JsValue, E> {
        let cb_event: types::GrabbedElementList =
            grabbing::GrabbedElementList::decode(buf)?.try_into()?;
        Ok(to_value(&cb_event)?)
    }
}
