use crate::*;
use extend::extend;
use prost::Message;
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::prelude::*;

#[extend(observe)]
pub struct ObserveOptions;

#[extend(observe)]
pub struct DltParserSettings;

#[extend(observe)]
pub struct DltFilterConfig;

#[extend(observe)]
pub struct SomeIpParserSettings;

#[extend(observe)]
pub struct ProcessTransportConfig;

#[extend(observe_origin)]
pub struct File;

#[extend(observe_origin)]
pub struct Concat;

#[extend(observe_origin)]
pub struct Stream;

#[extend(observe)]
pub struct SerialTransportConfig;

#[extend(observe)]
pub struct ObserveOrigin;

#[extend(observe)]
pub struct FileFormat;
