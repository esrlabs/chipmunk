use std::{
    io::{self, Read},
    path::Path,
};

use sources::plugins::{ByteSourceInput, PluginByteSourceGeneralSetttings};
use wasmtime::component::Component;

use crate::{
    semantic_version::SemanticVersion, v0_1_0, wasm_host::get_wasm_host, PluginHostInitError,
};

const BYTESOURCE_INTERFACE_NAME: &str = "chipmunk:plugin/byte-source";

/// Path of input file directory that will presented to the plugins.
pub(crate) const INPUT_DIR_PATH: &str = "./input";

pub enum PluginByteSource {
    Ver010(v0_1_0::bytesource::PluginByteSource),
}

impl PluginByteSource {
    pub async fn create(
        plugin_path: impl AsRef<Path>,
        input: ByteSourceInput,
        general_config: &PluginByteSourceGeneralSetttings,
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

        if interface_name != BYTESOURCE_INTERFACE_NAME {
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
                let source = v0_1_0::bytesource::PluginByteSource::create(
                    component,
                    input,
                    general_config,
                    config_path,
                )
                .await?;

                Ok(Self::Ver010(source))
            }
            invalid_version => Err(PluginHostInitError::PluginInvalid(format!(
                "Plugin version {invalid_version} is not supported"
            ))),
        }
    }

    async fn read_next(&self, len: usize) -> io::Result<Vec<u8>> {
        match self {
            PluginByteSource::Ver010(source) => source.read_next(len).await,
        }
    }
}

impl Read for PluginByteSource {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let len = buf.len();

        let bytes = futures::executor::block_on(self.read_next(len))?;

        let results_len = bytes.len();

        buf[..results_len].copy_from_slice(&bytes);

        Ok(results_len)
    }
}
