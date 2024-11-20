use crate::*;
use extend::extend;
use prost::Message;
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::prelude::*;

#[extend(progress)]
pub struct Ticks;

#[extend(progress)]
pub struct LifecycleTransition;

#[extend(progress)]
pub struct Started;

#[extend(progress)]
pub struct TicksWithUuid;
