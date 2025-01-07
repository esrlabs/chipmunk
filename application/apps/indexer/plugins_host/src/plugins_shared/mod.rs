use anyhow::Context;
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtxBuilder};

use crate::{
    plugins_manager::RenderOptions, semantic_version::SemanticVersion, PluginHostInitError,
};

pub mod plugin_errors;

/// Creates [`WasiCtxBuilder`] with shared configurations, giving the plugin read access to
/// their configuration files' directories.
pub fn get_wasi_ctx_builder(
    plugin_configs: &[stypes::PluginConfigItem],
) -> Result<WasiCtxBuilder, PluginHostInitError> {
    use stypes::PluginConfigValue as ConfValue;
    let mut ctx = WasiCtxBuilder::new();
    ctx.inherit_stdout().inherit_stderr().inherit_env();

    // Gives read access to parent directories of the plugin configuration files.
    for config_path in plugin_configs.iter().filter_map(|item| match &item.value {
        ConfValue::Path(path) => Some(path),
        ConfValue::Boolean(_)
        | ConfValue::Number(_)
        | ConfValue::Float(_)
        | ConfValue::Text(_)
        | ConfValue::Dropdown(_) => None,
    }) {
        let config_dir = config_path.parent().ok_or(PluginHostInitError::IO(format!(
            "Resolve config file parent failed. File path: {}",
            config_path.display()
        )))?;

        ctx.preopened_dir(
            config_dir,
            config_dir.to_string_lossy(),
            DirPerms::READ,
            FilePerms::READ,
        )
        .with_context(|| {
            format!(
                "Preopen directory with read access failed. Path: {}",
                config_dir.display()
            )
        })?;
    }

    Ok(ctx)
}

// Represents the retrieved static information form parser WASM file.
pub(crate) struct PluginInfo {
    pub version: SemanticVersion,
    pub config_schemas: Vec<stypes::PluginConfigSchemaItem>,
    pub render_options: RenderOptions,
}
