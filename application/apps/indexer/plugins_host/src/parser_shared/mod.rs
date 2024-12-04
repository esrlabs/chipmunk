use std::path::Path;

use sources::plugins as pl;
use wasmtime::component::Component;

use crate::{
    plugins_manager::ValidPluginInfo, plugins_shared::plugin_errors::PluginError,
    semantic_version::SemanticVersion, v0_1_0, wasm_host::get_wasm_host, PluginHostInitError,
    PluginParseMessage, PluginType, WasmPlugin,
};

pub mod plugin_parse_message;
mod render_options;

pub use render_options::RenderOptions;

const PARSER_INTERFACE_NAME: &str = "chipmunk:plugin/parser";

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
    pub async fn get_info(
        _plugin_path: impl AsRef<Path>,
    ) -> Result<ValidPluginInfo, PluginHostInitError> {
        todo!()
    }

    pub async fn create(
        plugin_path: impl AsRef<Path>,
        general_config: &pl::PluginParserGeneralSetttings,
        plugin_configs: Vec<pl::ConfigItem>,
    ) -> Result<Self, PluginHostInitError> {
        let engine = get_wasm_host()
            .map(|host| &host.engine)
            .map_err(|err| err.to_owned())?;

        if !plugin_path.as_ref().exists() {
            return Err(PluginHostInitError::IO("Plugin path doesn't exist".into()));
        }

        if !plugin_path.as_ref().is_file() {
            return Err(PluginHostInitError::IO("Plugin path is not a file".into()));
        }

        let component = Component::from_file(engine, plugin_path)
            .map_err(|err| PluginHostInitError::PluginInvalid(err.to_string()))?;

        let component_types = component.component_type();

        let export_info = component_types.exports(engine).next().ok_or_else(|| {
            PluginHostInitError::PluginInvalid("Plugin doesn't have exports information".into())
        })?;

        let (interface_name, version) = export_info.0.split_once('@').ok_or_else(|| {
            PluginHostInitError::PluginInvalid(
                "Plugin package schema doesn't match `wit` file definitions".into(),
            )
        })?;

        if interface_name != PARSER_INTERFACE_NAME {
            return Err(PluginHostInitError::PluginInvalid(
                "Plugin package name doesn't match `wit` file".into(),
            ));
        }

        let version: SemanticVersion = version.parse().map_err(|err| {
            PluginHostInitError::PluginInvalid(format!("Plugin version parsing failed: {err}"))
        })?;

        match version {
            SemanticVersion {
                major: 0,
                minor: 1,
                patch: 0,
            } => {
                let parser =
                    v0_1_0::parser::PluginParser::create(component, general_config, plugin_configs)
                        .await?;
                Ok(Self {
                    parser: PlugVerParser::Ver010(parser),
                    errors_counter: 0,
                })
            }
            invalid_version => Err(PluginHostInitError::PluginInvalid(format!(
                "Plugin version {invalid_version} is not supported"
            ))),
        }
    }

    pub fn get_render_options(&mut self) -> Result<RenderOptions, PluginError> {
        match &mut self.parser {
            PlugVerParser::Ver010(parser) => parser.get_render_options(),
        }
    }
}

impl WasmPlugin for PluginsParser {
    fn get_type() -> PluginType {
        PluginType::Parser
    }

    fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError> {
        match &mut self.parser {
            PlugVerParser::Ver010(parser) => parser.plugin_version(),
        }
    }

    fn get_config_schemas(&mut self) -> Result<Vec<pl::ConfigSchemaItem>, PluginError> {
        match &mut self.parser {
            PlugVerParser::Ver010(parser) => parser.get_config_schemas(),
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
