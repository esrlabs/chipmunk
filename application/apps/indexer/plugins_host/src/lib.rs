//! Library contains implementation for plugins system in Chipmunk using WASM with
//! the component model approach.
//! The used runtime for the plugin is [wasmtime](https://docs.rs/wasmtime/latest/wasmtime/)

mod bytesource_shared;
mod parser_shared;
pub mod plugins_manager;
mod plugins_shared;
mod producer_shared;
mod v0_1_0;
mod wasm_host;

use plugins_shared::plugin_errors::PluginError;

pub use parser_shared::PluginsParser;

pub use bytesource_shared::PluginsByteSource;

pub use producer_shared::PluginsProducer;

pub use plugins_shared::{
    plugin_errors::{PluginGuestError, PluginHostError},
    plugin_parse_message::PluginParseMessage,
};
use stypes::{PluginType, SemanticVersion};

/// Provided needed method and definitions for all WASM plugins in Chipmunk.
#[allow(async_fn_in_trait)]
pub trait WasmPlugin {
    /// Provides the Type of the plugin.
    fn get_type() -> PluginType;

    /// Provides the current semantic version of the plugin.
    ///
    /// # Note
    /// This version is for the plugin only and is different from the plugin's API version.
    async fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError>;

    /// Provides the schemas for the configurations required by the plugin, which
    /// will be specified by the users.
    ///
    /// These schemas define the expected structure, types, and constraints
    /// for plugin-specific configurations. The values of these configurations
    /// will be passed to the initializing method of the plugin.
    async fn get_config_schemas(
        &mut self,
    ) -> Result<Vec<stypes::PluginConfigSchemaItem>, PluginError>;
}
