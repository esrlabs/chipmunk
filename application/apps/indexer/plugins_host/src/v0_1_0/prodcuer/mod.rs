use bindings::Produce;
use parsers::MessageStreamItem;
use producer_plugin_state::ProducerPluginState;
use stypes::{ParserRenderOptions, PluginConfigSchemaItem, SemanticVersion};
use wasmtime::{component::Component, Store};
use wasmtime_wasi::WasiCtx;

use crate::{
    plugins_shared::{plugin_errors::PluginError, PluginStaticInfo},
    producer_shared::PluginProduceError,
    PluginHostError, PluginParseMessage,
};

mod bindings;
mod producer_plugin_state;

/// Host of the producer plugin for plugins API version 0.1.0
pub struct PluginProducer {
    store: Store<ProducerPluginState>,
    plugin_bindings: Produce,
}

//TODO AAZ: All functions are still placeholders for now.

impl PluginProducer {
    /// Load wasm file temporally to retrieve the static plugin information defined by `wit` file
    pub(crate) async fn get_info(_component: Component) -> Result<PluginStaticInfo, PluginError> {
        todo!()
    }

    /// Creates a new producer instance without initializing it with custom configurations.
    async fn create(_component: Component, _ctx: WasiCtx) -> Result<Self, PluginHostError> {
        todo!()
    }

    /// Initialize producer instance with the needed configuration to be used within a session.
    pub async fn initialize(
        _component: Component,
        _general_config: &stypes::PluginProducerGeneralSettings,
        _plugin_configs: Vec<stypes::PluginConfigItem>,
    ) -> Result<Self, PluginHostError> {
        todo!()
    }

    /// Requests plugins version from plugin Guest.
    pub async fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError> {
        todo!()
    }

    /// Request configuration schemas from the plugin Guest.
    pub async fn get_config_schemas(&mut self) -> Result<Vec<PluginConfigSchemaItem>, PluginError> {
        todo!()
    }

    /// Requests render options from plugin Guest.
    pub async fn get_render_options(&mut self) -> Result<ParserRenderOptions, PluginError> {
        todo!()
    }

    /// Requests plugin guest to produce the next chunk of items filling them in the provided buffer.
    pub async fn produce_next(
        &mut self,
        _buffer: &mut Vec<(usize, MessageStreamItem<PluginParseMessage>)>,
    ) -> Result<(), PluginProduceError> {
        todo!()
    }
}
