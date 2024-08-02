use std::path::Path;

use wasmtime_wasi::{DirPerms, FilePerms, WasiCtxBuilder};

use crate::PluginHostInitError;

pub mod plugin_init_error;

/// Creates [`WasiCtxBuilder`] with shared configurations, giving the plugin access to their
/// configurations file directory.
pub fn get_wasi_ctx_builder(
    config_path: Option<impl AsRef<Path>>,
) -> Result<WasiCtxBuilder, PluginHostInitError> {
    let mut ctx = WasiCtxBuilder::new();
    ctx.inherit_stdout().inherit_stderr().inherit_env();

    if let Some(config_path) = config_path {
        let config_path = config_path.as_ref();
        let config_dir = config_path.parent().ok_or(PluginHostInitError::IO(
            "Resolve config file parent failed".into(),
        ))?;

        ctx.preopened_dir(
            config_dir,
            config_dir.to_string_lossy(),
            DirPerms::READ,
            FilePerms::READ,
        )?;
    }

    Ok(ctx)
}
