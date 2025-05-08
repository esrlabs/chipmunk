use std::path::{Path, PathBuf};

use components::ComponentDescriptor;
use stypes::{PluginInfo, SemanticVersion};
use wasmtime::component::Component;

use crate::{
    PluginHostError, PluginParseMessage, PluginType, WasmPlugin,
    plugins_shared::{
        load::{WasmComponentInfo, load_and_inspect},
        plugin_errors::PluginError,
    },
    v0_1_0,
};

pub mod plugin_parse_message;

/// Marker for a column separator in the output string.
pub const COLUMN_SEP: &str = "\u{0004}";

/// Uses [`WasmHost`](crate::wasm_host::WasmHost) to communicate with WASM parser plugin.
pub struct PluginsParser {
    /// The actual parser for each supported version in plugins API.
    parser: PlugVerParser,
    /// Tracks the number of consecutive recoverable errors sent by a plugin.
    /// This helps prevent plugins from causing harm to the Chipmunk system
    /// by sending too many recoverable errors in a row.
    errors_counter: usize,
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
            SemanticVersion::V0_1_0 => v0_1_0::parser::PluginParser::get_info(component).await?,
            invalid_version => {
                return Err(PluginHostError::PluginInvalid(format!(
                    "Plugin version {invalid_version} is not supported"
                ))
                .into());
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
            SemanticVersion::V0_1_0 => {
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

/// The maximum number of consecutive recoverable errors allowed from a plugin.
/// If a plugin exceeds this number, it may be considered harmful to the system.
struct PluginErrorLimits;

impl PluginErrorLimits {
    /// Limit for consecutive [`parsers::Error::Parse`] errors.
    const PARSE_ERROR_LIMIT: usize = 2000;
    /// Limit for consecutive [`parsers::Error::Incomplete`] errors.
    const INCOMPLETE_ERROR_LIMIT: usize = 50;
}

use definitions as defs;
impl defs::Parser<PluginParseMessage> for PluginsParser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> Result<Vec<(usize, Option<defs::ParseYield<PluginParseMessage>>)>, defs::ParserError> {
        let res = match &mut self.parser {
            PlugVerParser::Ver010(parser) => parser.parse(input, timestamp),
        };

        // Check for consecutive errors.
        match &res {
            Ok(_) | Err(defs::ParserError::Unrecoverable(_)) | Err(defs::ParserError::Eof) => {
                self.errors_counter = 0;
            }
            Err(defs::ParserError::Parse(err)) => {
                self.errors_counter += 1;
                if self.errors_counter > PluginErrorLimits::PARSE_ERROR_LIMIT {
                    self.errors_counter = 0;
                    return Err(defs::ParserError::Unrecoverable(format!(
                        "Plugin parser returned more than \
                        {} recoverable parse errors consecutively\n. Parse Error: {err}",
                        PluginErrorLimits::PARSE_ERROR_LIMIT
                    )));
                }
            }
            Err(defs::ParserError::Incomplete) => {
                self.errors_counter += 1;
                if self.errors_counter > PluginErrorLimits::INCOMPLETE_ERROR_LIMIT {
                    self.errors_counter = 0;
                    return Err(defs::ParserError::Unrecoverable(format!(
                        "Plugin parser returned more than \
                        {} recoverable incomplete errors consecutively",
                        PluginErrorLimits::INCOMPLETE_ERROR_LIMIT
                    )));
                }
            }
        }

        res
    }
}

#[derive(Default)]
struct Descriptor {}

impl ComponentDescriptor for Descriptor {
    fn is_compatible(&self, _origin: &stypes::SourceOrigin) -> bool {
        true
    }
    /// **ATTANTION** That's placeholder. Should be another way to delivery data
    fn ident(&self) -> stypes::Ident {
        stypes::Ident {
            name: String::from("Plugin"),
            desc: String::from("Plugin"),
            uuid: uuid::Uuid::new_v4(),
        }
    }
    fn ty(&self) -> stypes::ComponentType {
        stypes::ComponentType::Parser
    }
}

impl components::Component for PluginsParser {
    fn register(components: &mut components::Components) -> Result<(), stypes::NativeError> {
        components.register(Descriptor::default())?;
        Ok(())
    }
}
