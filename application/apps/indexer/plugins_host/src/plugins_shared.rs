use std::path::{Path, PathBuf};

use thiserror::Error;
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtxBuilder};

use crate::{wasm_host::WasmHostInitError, PluginHostInitError};

/// Path of plugin configurations directory that will presented to the plugins.
const PLUGINS_CONFIG_DIR_PATH: &str = "./config";

/// Creates [`WasiCtxBuilder`] with shared configurations, giving the plugin access to their
/// configurations file directory.
pub fn get_wasi_ctx_builder(
    config_path: Option<impl AsRef<Path>>,
) -> Result<WasiCtxBuilder, PluginHostInitError> {
    let mut ctx = WasiCtxBuilder::new();
    ctx.inherit_stdout().inherit_stderr();
    if let Some(config_path) = config_path {
        let config_path = config_path.as_ref();
        let config_dir = config_path.parent().ok_or(PluginHostInitError::IO(
            "Resolve config file parent failed".into(),
        ))?;

        ctx.preopened_dir(
            config_dir,
            PLUGINS_CONFIG_DIR_PATH,
            DirPerms::READ,
            FilePerms::READ,
        )?;
    }

    Ok(ctx)
}

/// Get plugin configuration path as it should be presented to the plugin
pub fn get_plugin_config_path(
    real_config_path: impl AsRef<Path>,
) -> Result<PathBuf, PluginHostInitError> {
    let file_name = real_config_path
        .as_ref()
        .file_name()
        .ok_or_else(|| PluginHostInitError::IO("Resolve config file name failed".into()))?;

    let plugin_config_path = PathBuf::from(PLUGINS_CONFIG_DIR_PATH).join(file_name);

    Ok(plugin_config_path)
}
