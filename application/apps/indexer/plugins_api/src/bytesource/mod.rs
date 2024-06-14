// TODO: Temporally place holder
#![allow(dead_code, unused_imports, unused)]

use wit_bindgen::generate;

use self::{
    chipmunk::plugin::{bytesource_types::*, shared_types::*},
    exports::chipmunk::plugin::byte_source::Guest,
};

generate!({
    path: "wit/v_0.1.0",
    world: "bytesource-plugin",
});

struct PluginByteSource;

impl Guest for PluginByteSource {
    /// Initialize the bytesource with the given configurations
    fn init(
        general_configs: SourceConfig,
        plugin_configs: Option<String>,
    ) -> Result<(), InitError> {
        todo!()
    }

    /// Reads more bytes returning a list of bytes with the given length if possible
    fn read(len: u64) -> Result<_rt::Vec<u8>, SourceError> {
        todo!()
    }
}
