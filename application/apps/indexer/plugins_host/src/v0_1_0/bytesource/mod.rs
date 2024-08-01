//TODO AAZ: Suppress warnings while developing
#![allow(dead_code, unused_imports, unused)]

use std::path::{Path, PathBuf};

use sources::plugins::{ByteSourceInput, PluginByteSourceGeneralSetttings};
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtxBuilder};

use crate::{
    bytesource_shared::INPUT_DIR_PATH, plugins_shared::get_wasi_ctx_builder, PluginHostInitError,
};

pub struct PluginByteSource {}

impl PluginByteSource {
    pub fn create(
        plugin_path: impl AsRef<Path>,
        input: ByteSourceInput,
        general_config: &PluginByteSourceGeneralSetttings,
        config_path: Option<impl AsRef<Path>>,
    ) -> Result<Self, PluginHostInitError> {
        // This is just handling the case of input file. The rest is missing

        let mut ctx = get_wasi_ctx_builder(config_path)?;

        if let ByteSourceInput::File(file_path) = input {
            let file_dir = file_path.parent().ok_or(PluginHostInitError::IO(
                "Resolve input file parent failed".into(),
            ))?;
            ctx.preopened_dir(file_dir, INPUT_DIR_PATH, DirPerms::READ, FilePerms::READ)?;
        }

        todo!()
    }
}
