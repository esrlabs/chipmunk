use std::path::{Path, PathBuf};

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
    prodcuer: PlugVerProducer,
    /// Internal beffer for prdouced restuls to avoid allocating memory on each call.
    items_buffer: Vec<(usize, parsers::MessageStreamItem<PluginParseMessage>)>,
}

/// Represents the prodcuer plugin for each supported version in plugins API.
enum PlugVerProducer {
    Ver010(v0_1_0::prodcuer::PluginProducer),
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
            } => v0_1_0::prodcuer::PluginProducer::get_info(component).await?,
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
        let (component, version) = Self::load(&plugin_path).await?;

        match version {
            SemanticVersion {
                major: 0,
                minor: 1,
                patch: 0,
            } => {
                let producer = v0_1_0::prodcuer::PluginProducer::initialize(
                    component,
                    general_config,
                    plugin_configs,
                )
                .await?;
                Ok(Self {
                    prodcuer: PlugVerProducer::Ver010(producer),
                    items_buffer: Vec::new(),
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
        match &mut self.prodcuer {
            PlugVerProducer::Ver010(producer) => producer.plugin_version().await,
        }
    }

    async fn get_config_schemas(&mut self) -> Result<Vec<PluginConfigSchemaItem>, PluginError> {
        match &mut self.prodcuer {
            PlugVerProducer::Ver010(producer) => producer.get_config_schemas().await,
        }
    }
}

impl MessageProducer<PluginParseMessage> for PluginsProducer {
    async fn read_next_segment(
        &mut self,
    ) -> Option<&mut Vec<(usize, parsers::MessageStreamItem<PluginParseMessage>)>> {
        self.items_buffer.clear();
        match &mut self.prodcuer {
            PlugVerProducer::Ver010(producer) => {
                match producer.produce_next(&mut self.items_buffer).await {
                    Ok(()) => Some(&mut self.items_buffer),
                    Err(err) => {
                        // TODO: Show errors to user when read_next_segment() signature changes
                        // to provide the errors instead of logging them silently.
                        log::error!("Producing log items from plagin failed. Error: {err}");
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
