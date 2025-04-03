//! Module to handle loading plugins WASM binaries and inspecting their `WIT` infos.

use std::path::Path;

use stypes::{PluginType, SemanticVersion};
use wasmtime::component::Component;

use crate::{wasm_host::get_wasm_host, PluginHostError};

/// Interface name for the parser plugin with the package name as defined in WIT file.
const PARSER_INTERFACE_NAME: &str = "chipmunk:parser/parser";

/// Interface name for the byte-source plugin with the package name as defined in WIT file.
const BYTESOURCE_INTERFACE_NAME: &str = "chipmunk:bytesource/byte-source";

/// Represents a WASM plugin [`Component`] alongside with extracted information from it.
pub(crate) struct WasmComponentInfo {
    /// The compiled component from plugin WASM file.
    pub component: Component,
    /// Type of the plugin.
    pub plugin_type: PluginType,
    /// Version of `WIT` API used within the plugin WASM file.
    pub version: SemanticVersion,
}

/// Loads, inspect and validate a plugin returning its component alongside with
/// extracted infos from it.
pub(crate) async fn load_and_inspect(
    plugin_path: impl AsRef<Path>,
) -> Result<WasmComponentInfo, PluginHostError> {
    let engine = get_wasm_host()
        .map(|host| &host.engine)
        .map_err(|err| PluginHostError::from(err.to_owned()))?;
    let plugin_path = plugin_path.as_ref();

    if !plugin_path.exists() {
        return Err(PluginHostError::IO("Plugin path doesn't exist".into()));
    }

    if !plugin_path.is_file() {
        return Err(PluginHostError::IO("Plugin path is not a file".into()));
    }

    let component = Component::from_file(engine, plugin_path)
        .map_err(|err| PluginHostError::PluginInvalid(err.to_string()))?;

    let component_types = component.component_type();

    let export_info = component_types.exports(engine).next().ok_or_else(|| {
        PluginHostError::PluginInvalid("Plugin doesn't have exports information".into())
    })?;

    let (interface_name, version) = export_info.0.split_once('@').ok_or_else(|| {
        PluginHostError::PluginInvalid(
            "Plugin package schema doesn't match `wit` file definitions".into(),
        )
    })?;

    let plugin_type = match interface_name {
        PARSER_INTERFACE_NAME => PluginType::Parser,
        BYTESOURCE_INTERFACE_NAME => PluginType::ByteSource,
        invalid => {
            return Err(PluginHostError::PluginInvalid(format!(
                "Unknown plugin interface name '{invalid}'",
            )))
        }
    };

    let version: SemanticVersion = version.parse().map_err(|err| {
        PluginHostError::PluginInvalid(format!("Plugin version parsing failed: {err}"))
    })?;

    Ok(WasmComponentInfo {
        component,
        plugin_type,
        version,
    })
}
