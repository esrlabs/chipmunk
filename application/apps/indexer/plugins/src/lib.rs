//TODO AAZ: Suppress warnings while developing
#![allow(dead_code, unused_imports, unused)]

mod parser_shared;
mod plugins_shared;
mod semantic_version;
mod v0_1_0;
mod wasm_host;

pub use parser_shared::{
    plugin_init_error::{PluginGuestInitError, PluginHostInitError},
    plugin_parse_message::PluginParseMessage,
    PluginParser,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PluginType {
    Parser,
    ByteSource,
}

pub trait WasmPlugin {
    fn get_type() -> PluginType;
}
