mod bytesource_shared;
mod parser_shared;
pub mod plugins_manager;
mod plugins_shared;
mod semantic_version;
mod v0_1_0;
mod wasm_host;

use plugins_shared::plugin_errors::PluginError;
use semantic_version::SemanticVersion;
use serde::{Deserialize, Serialize};

pub use parser_shared::{plugin_parse_message::PluginParseMessage, PluginsParser};

pub use bytesource_shared::PluginsByteSource;

pub use plugins_shared::plugin_errors::{PluginGuestInitError, PluginHostInitError};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PluginType {
    Parser,
    ByteSource,
}

// Trait is used with Chipmunk only.
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
