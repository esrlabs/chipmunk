use std::path::{Path, PathBuf};

use wasmtime_wasi::{DirPerms, FilePerms, WasiCtxBuilder};

use crate::{plugins_shared::get_wasi_ctx_builder, PluginHostInitError};

/// Path of input file directory that will presented to the plugins.
const INPUT_DIR_PATH: &str = "./input";

#[derive(Debug, Clone)]
/// Represents The input source for byte source to read from
pub enum ByteSourceInput {
    File(PathBuf),
    Other,
}

pub struct PluginByteSource {}

impl PluginByteSource {
    pub fn create(
        input: ByteSourceInput,
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
