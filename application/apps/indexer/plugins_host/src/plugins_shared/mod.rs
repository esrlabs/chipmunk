use anyhow::Context;
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtxBuilder};

use sources::plugins as pl;

use crate::PluginHostInitError;

pub mod plugin_init_error;

/// Creates [`WasiCtxBuilder`] with shared configurations, giving the plugin read access to
/// their configuration files' directories.
pub fn get_wasi_ctx_builder(
    plugin_configs: &[pl::ConfigItem],
) -> Result<WasiCtxBuilder, PluginHostInitError> {
    let mut ctx = WasiCtxBuilder::new();
    ctx.inherit_stdout().inherit_stderr().inherit_env();

    // Gives read access to parent directories of the plugin configuration files.
    for config_path in plugin_configs.iter().filter_map(|item| match &item.value {
        pl::ConfigValue::Path(path) => Some(path),
        pl::ConfigValue::Boolean(_)
        | pl::ConfigValue::Number(_)
        | pl::ConfigValue::Float(_)
        | pl::ConfigValue::Text(_)
        | pl::ConfigValue::Dropdown(_) => None,
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
