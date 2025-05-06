use std::path::{Path, PathBuf};

use parsers::MessageStreamItem;
use sources::producer::MessageProducer;
use stypes::{PluginConfigSchemaItem, PluginInfo, PluginType, SemanticVersion};
use wasmtime::component::Component;

use crate::{
    plugins_shared::{
        load::{load_and_inspect, WasmComponentInfo},
        plugin_errors::PluginError,
    },
    v0_1_0, PluginHostError, PluginParseMessage, WasmPlugin,
};

pub use producer_error::PluginProduceError;

mod producer_error;

/// Uses [`WasmHost`](crate::wasm_host::WasmHost) to communicate with WASM producer plugin.
pub struct PluginsProducer {
    /// The underline producer plugin for the matching API version.
    producer: PlugVerProducer,
    /// Internal buffer for produced results to avoid allocating memory on each call.
    items_buffer: Vec<(usize, parsers::MessageStreamItem<PluginParseMessage>)>,
    /// Specifies if the produce is done producing items for the session.
    done: bool,
}

/// Represents the producer plugin for each supported version in plugins API.
enum PlugVerProducer {
    Ver010(v0_1_0::producer::PluginProducer),
}

impl PluginsProducer {
    /// Loads the plugin and extract the needed plugin info if valid.
    pub async fn get_info(plugin_path: PathBuf) -> Result<PluginInfo, PluginError> {
        let (component, version) = Self::load(&plugin_path).await?;

        let plug_info = match version {
            SemanticVersion {
                major: 0,
                minor: 1,
                patch: 0,
            } => v0_1_0::producer::PluginProducer::get_info(component).await?,
            invalid_version => {
                return Err(PluginHostError::PluginInvalid(format!(
                    "Plugin Version {invalid_version} is not supported"
                ))
                .into())
            }
        };

        let plugin_info = PluginInfo {
            wasm_file_path: plugin_path,
            api_version: version,
            plugin_version: plug_info.version,
            config_schemas: plug_info.config_schemas,
            render_options: plug_info.render_options,
        };

        Ok(plugin_info)
    }

    /// Loads and validate a plugin returning the its [`Component`] and API [`SemanticVersion`]
    async fn load(plugin_path: &Path) -> Result<(Component, SemanticVersion), PluginHostError> {
        let WasmComponentInfo {
            component,
            plugin_type,
            version,
        } = load_and_inspect(plugin_path).await?;

        if plugin_type != PluginType::Producer {
            return Err(PluginHostError::PluginInvalid(format!(
                "Invalid plugin type: {plugin_type}"
            )));
        }

        Ok((component, version))
    }

    /// Initialize producer plugin instance with the needed configuration to be used within sessions.
    pub async fn initialize(
        plugin_path: &Path,
        general_config: &stypes::PluginProducerGeneralSettings,
        plugin_configs: Vec<stypes::PluginConfigItem>,
    ) -> Result<Self, PluginHostError> {
        let (component, version) = Self::load(plugin_path).await?;

        match version {
            SemanticVersion {
                major: 0,
                minor: 1,
                patch: 0,
            } => {
                let producer = v0_1_0::producer::PluginProducer::initialize(
                    component,
                    general_config,
                    plugin_configs,
                )
                .await?;
                Ok(Self {
                    producer: PlugVerProducer::Ver010(producer),
                    items_buffer: Vec::new(),
                    done: false,
                })
            }
            invalid_version => Err(PluginHostError::PluginInvalid(format!(
                "Plugin version {invalid_version} is not supported"
            ))),
        }
    }
}

impl WasmPlugin for PluginsProducer {
    fn get_type() -> PluginType {
        PluginType::Producer
    }

    async fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError> {
        match &mut self.producer {
            PlugVerProducer::Ver010(producer) => producer.plugin_version().await,
        }
    }

    async fn get_config_schemas(&mut self) -> Result<Vec<PluginConfigSchemaItem>, PluginError> {
        match &mut self.producer {
            PlugVerProducer::Ver010(producer) => producer.get_config_schemas().await,
        }
    }
}

impl MessageProducer<PluginParseMessage> for PluginsProducer {
    async fn read_next_segment(
        &mut self,
    ) -> Option<&mut Vec<(usize, parsers::MessageStreamItem<PluginParseMessage>)>> {
        if self.done {
            return None;
        }
        self.items_buffer.clear();
        match &mut self.producer {
            PlugVerProducer::Ver010(producer) => {
                match producer.produce_next(&mut self.items_buffer).await {
                    Ok(()) => {
                        //TODO AAZ: Check if this check impacts the performance.
                        // Alternatively we can stop the session on Done message inside
                        // `run_producer()` method in `observing/mod.rs`
                        //
                        // Mark the session as done to prevent calling the plugin again
                        // once it's done.
                        // The plugin is considered finished if it returns `MessageStreamItem::Done`
                        // or if it returns no items.
                        if self
                            .items_buffer
                            .last()
                            .is_none_or(|item| matches!(item.1, MessageStreamItem::Done))
                        {
                            self.done = true;
                        }
                        Some(&mut self.items_buffer)
                    }
                    Err(err) => {
                        // TODO: Show errors to user when read_next_segment() signature changes
                        // to provide the errors instead of logging them silently.
                        log::error!("Producing log items from plugin failed. Error: {err}");
                        None
                    }
                }
            }
        }
    }

    async fn sde_income(
        &mut self,
        _msg: stypes::SdeRequest,
    ) -> Result<stypes::SdeResponse, sources::Error> {
        //TODO AAZ: Clarify if sde should be supported.
        panic!("Producer Plugins don't support sde");
    }
}
