use std::path::{Path, PathBuf};

use stypes::{PluginInfo, SemanticVersion};
use wasmtime::component::Component;

use crate::{
    plugins_shared::{
        load::{load_and_inspect, WasmComponentInfo},
        plugin_errors::PluginError,
    },
    v0_1_0, PluginHostError, PluginParseMessage, PluginType, WasmPlugin,
};

pub mod plugin_parse_message;

/// Marker for a column separator in the output string.
pub const COLUMN_SEP: &str = "\u{0004}";

/// The maximum number of consecutive recoverable errors allowed from a plugin.
/// If a plugin exceeds this number, it may be considered harmful to the system.
const MAX_ALLOWED_CONSECUTIVE_ERRORS: u8 = 20;

/// Uses [`WasmHost`](crate::wasm_host::WasmHost) to communicate with WASM parser plugin.
pub struct PluginsParser {
    /// The actual parser for each supported version in plugins API.
    parser: PlugVerParser,
    /// Tracks the number of consecutive recoverable errors sent by a plugin.
    /// This helps prevent plugins from causing harm to the Chipmunk system
    /// by sending too many recoverable errors in a row.
    errors_counter: u8,
}

/// Represents the plugin parser for each supported version in plugins API.
enum PlugVerParser {
    Ver010(v0_1_0::parser::PluginParser),
}

impl PluginsParser {
    /// Loads the plugin and extract the needed plugin info if valid.
    pub async fn get_info(plugin_path: PathBuf) -> Result<PluginInfo, PluginError> {
        let (component, version) = Self::load(&plugin_path).await?;

        let plug_info = match version {
            SemanticVersion {
                major: 0,
                minor: 1,
                patch: 0,
            } => v0_1_0::parser::PluginParser::get_info(component).await?,
            invalid_version => {
                return Err(PluginHostError::PluginInvalid(format!(
                    "Plugin version {invalid_version} is not supported"
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
    async fn load(
        plugin_path: impl AsRef<Path>,
    ) -> Result<(Component, SemanticVersion), PluginHostError> {
        let WasmComponentInfo {
            component,
            plugin_type,
            version,
        } = load_and_inspect(&plugin_path).await?;

        if plugin_type != PluginType::Parser {
            return Err(PluginHostError::PluginInvalid(format!(
                "Invalid plugin type {plugin_type}"
            )));
        }

        Ok((component, version))
    }

    /// Initialize parser instance with the needed configuration to be used within sessions.
    pub async fn initialize(
        plugin_path: impl AsRef<Path>,
        general_config: &stypes::PluginParserGeneralSettings,
        plugin_configs: Vec<stypes::PluginConfigItem>,
    ) -> Result<Self, PluginHostError> {
        let (component, version) = Self::load(&plugin_path).await?;

        match version {
            SemanticVersion {
                major: 0,
                minor: 1,
                patch: 0,
            } => {
                let parser = v0_1_0::parser::PluginParser::initialize(
                    component,
                    general_config,
                    plugin_configs,
                )
                .await?;
                Ok(Self {
                    parser: PlugVerParser::Ver010(parser),
                    errors_counter: 0,
                })
            }
            invalid_version => Err(PluginHostError::PluginInvalid(format!(
                "Plugin version {invalid_version} is not supported"
            ))),
        }
    }
}

impl WasmPlugin for PluginsParser {
    fn get_type() -> PluginType {
        PluginType::Parser
    }

    async fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError> {
        match &mut self.parser {
            PlugVerParser::Ver010(parser) => parser.plugin_version().await,
        }
    }

    async fn get_config_schemas(
        &mut self,
    ) -> Result<Vec<stypes::PluginConfigSchemaItem>, PluginError> {
        match &mut self.parser {
            PlugVerParser::Ver010(parser) => parser.get_config_schemas().await,
        }
    }
}

use parsers as p;
impl p::Parser<PluginParseMessage> for PluginsParser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<impl Iterator<Item = (usize, Option<p::ParseYield<PluginParseMessage>>)>, p::Error>
    {
        let res = match &mut self.parser {
            PlugVerParser::Ver010(parser) => parser.parse(input, timestamp),
        };

        match &res {
            Ok(_) | Err(p::Error::Unrecoverable(_)) => {
                self.errors_counter = 0;
            }
            Err(p::Error::Parse(_)) | Err(p::Error::Incomplete) | Err(p::Error::Eof) => {
                self.errors_counter += 1;
                if self.errors_counter > MAX_ALLOWED_CONSECUTIVE_ERRORS {
                    self.errors_counter = 0;
                    return Err(p::Error::Unrecoverable(format!(
                        "Plugin parser returned more than \
                        {MAX_ALLOWED_CONSECUTIVE_ERRORS} recoverable errors consecutively"
                    )));
                }
            }
        }

        res
    }
}
