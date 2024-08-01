mod bytesource_shared;
mod parser_shared;
mod plugins_shared;
mod semantic_version;
mod v0_1_0;
mod wasm_host;

pub use parser_shared::{plugin_parse_message::PluginParseMessage, PluginParser};

pub use bytesource_shared::PluginByteSource;

pub use plugins_shared::plugin_init_error::{PluginGuestInitError, PluginHostInitError};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PluginType {
    Parser,
    ByteSource,
}

pub trait WasmPlugin {
    fn get_type() -> PluginType;
}
