pub mod attachment;
pub mod error;
pub mod event;
pub mod grabbing;
pub mod sde;

// It would be nice to have traits for encode/decode, but wasm_bindgen doesn't feel good with
// trait implementation
//
// use crate::E;
// use wasm_bindgen::prelude::JsValue;//
// pub trait Decode {
//     fn decode(buf: &[u8]) -> Result<JsValue, E>;
// }

// pub trait Encode {
//     fn encode(val: JsValue) -> Result<Vec<u8>, E>;
// }
