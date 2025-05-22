use std::{collections::HashSet, path::PathBuf};

use anyhow::Context;
use rand::distributions::DistString;
use stypes::{RenderOptions, SemanticVersion};
use wasmtime_wasi::{thread_rng, DirPerms, FilePerms, WasiCtxBuilder};

use crate::PluginHostError;

pub mod load;
pub mod plugin_errors;

/// The name of plugins directory in operating system temporary directory.
const PLUGIN_TEMP_DIR_NAME: &str = "chipmunk_plugins";

/// Creates [`WasiCtxBuilder`] with shared configurations, giving the plugin read access to
/// their configuration files' directories, and read and write access to the plugins
/// temporary directory.
pub fn get_wasi_ctx_builder(
    plugin_configs: &[stypes::PluginConfigItem],
) -> Result<WasiCtxBuilder, PluginHostError> {
    use stypes::PluginConfigValue as ConfValue;
    let mut ctx = WasiCtxBuilder::new();
    ctx.inherit_stdout().inherit_stderr().inherit_env();

    let mut read_dirs = HashSet::new();

    // Gives read access to parent directories of the plugin configuration files.
    for config_path in plugin_configs
        .iter()
        .filter_map(|item| match &item.value {
            ConfValue::Files(paths) => Some(paths),
            ConfValue::Directories(paths) => Some(paths),
            ConfValue::Boolean(_)
            | ConfValue::Integer(_)
            | ConfValue::Float(_)
            | ConfValue::Text(_)
            | ConfValue::Dropdown(_) => None,
        })
        .flatten()
    {
        let config_dir = config_path.parent().ok_or(PluginHostError::IO(format!(
            "Resolve config file parent failed. File path: {}",
            config_path.display()
        )))?;

        // Avoid giving permissions for the same directory multiple times.
        if !read_dirs.insert(config_dir) {
            continue;
        }

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

    // Gives permissions for plugins temporary directory.
    let plug_temp_dir = plugins_temp_dir();
    if !plug_temp_dir.exists() {
        std::fs::create_dir_all(&plug_temp_dir).with_context(|| {
            format!(
                "Error while creating plugins temp directory. Path: {}",
                plug_temp_dir.display(),
            )
        })?;
    }
    ctx.preopened_dir(
        &plug_temp_dir,
        plug_temp_dir.to_string_lossy(),
        DirPerms::all(),
        FilePerms::all(),
    )?;

    Ok(ctx)
}

/// Creates directory for a plugin in chipmunk plugins temp directory with a random
/// directory name, then returns it on successful.
pub fn create_plug_temp_dir() -> std::io::Result<PathBuf> {
    let dir_name = rand::distributions::Alphanumeric.sample_string(&mut thread_rng(), 16);
    let temp_dir = plugins_temp_dir().join(dir_name);
    std::fs::create_dir_all(&temp_dir)?;

    Ok(temp_dir)
}

/// Provide the path for the plugin directory in the operating system temporary directory.
pub fn plugins_temp_dir() -> PathBuf {
    std::env::temp_dir().join(PLUGIN_TEMP_DIR_NAME)
}

// Represents the retrieved static information form plugin WASM file.
pub(crate) struct PluginInfo {
    /// The version of the plugins itself.
    /// # Note:
    /// This is different than the API version defined in WIT files that are used by the plugin.
    pub version: SemanticVersion,
    /// Schema definitions for the configurations needed by the plugin.
    pub config_schemas: Vec<stypes::PluginConfigSchemaItem>,
    /// Then render options for the plugins.
    pub render_options: RenderOptions,
}
