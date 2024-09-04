use std::path::Path;

use sources::plugins::PluginParserGeneralSetttings;
use wasmtime::component::Component;

use crate::{
    semantic_version::SemanticVersion, v0_1_0, wasm_host::get_wasm_host, PluginHostInitError,
    PluginParseMessage,
};

pub mod plugin_parse_message;

const PARSER_INTERFACE_NAME: &str = "chipmunk:plugin/parser";

pub enum PluginParser {
    Ver010(v0_1_0::parser::PluginParser),
}

impl PluginParser {
    pub async fn create(
        plugin_path: impl AsRef<Path>,
        general_config: &PluginParserGeneralSetttings,
        config_path: Option<impl AsRef<Path>>,
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
                    v0_1_0::parser::PluginParser::create(component, general_config, config_path)
                        .await?;
                Ok(PluginParser::Ver010(parser))
            }
            invalid_version => Err(PluginHostInitError::PluginInvalid(format!(
                "Plugin version {invalid_version} is not supported"
            ))),
        }
    }
}

use parsers as p;
impl p::Parser<PluginParseMessage> for PluginParser {
    fn parse(
        &mut self,
        input: &[u8],
        timestamp: Option<u64>,
    ) -> impl IntoIterator<Item = Result<(usize, Option<p::ParseYield<PluginParseMessage>>), p::Error>>
           + Send {
        match self {
            PluginParser::Ver010(parser) => parser.parse(input, timestamp),
        }
    }
}
