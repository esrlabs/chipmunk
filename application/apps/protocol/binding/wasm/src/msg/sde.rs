use crate::*;
use extend::extend;
use prost::Message;
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::prelude::*;

#[extend(sde)]
pub struct SdeRequest;

#[extend(sde)]
pub struct SdeResponse;
