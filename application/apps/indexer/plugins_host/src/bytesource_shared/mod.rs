//TODO AAZ: Suppress warnings while developing
#![allow(dead_code, unused_imports, unused)]

use std::path::{Path, PathBuf};

use sources::plugins::{ByteSourceInput, PluginByteSourceGeneralSetttings};

use crate::{v0_1_0, PluginHostInitError};

const BYTESOURCE_INTERFACE_NAME: &str = "chipmunk:plugin/byte-source";

/// Path of input file directory that will presented to the plugins.
pub(crate) const INPUT_DIR_PATH: &str = "./input";

pub enum PluginByteSource {
    Ver010(v0_1_0::bytesource::PluginByteSource),
}

impl PluginByteSource {
    pub fn create(
        plugin_path: impl AsRef<Path>,
        input: ByteSourceInput,
        general_config: &PluginByteSourceGeneralSetttings,
        config_path: Option<impl AsRef<Path>>,
    ) -> Result<Self, PluginHostInitError> {
        todo!()
    }
}
