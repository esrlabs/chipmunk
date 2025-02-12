use std::{
    io::{self, Read},
    path::{Path, PathBuf},
};

use stypes::{PluginInfo, PluginType, RenderOptions, SemanticVersion};
use wasmtime::component::Component;

use crate::{
    plugins_shared::plugin_errors::PluginError, v0_1_0, wasm_host::get_wasm_host,
    PluginHostInitError, WasmPlugin,
};

/// Interface name for the byte-source plugin with the package name as defined in WIT file.
const BYTESOURCE_INTERFACE_NAME: &str = "chipmunk:bytesource/byte-source";

/// The maximum number of consecutive returns with empty bytes allowed from a plugin.
/// If a plugin exceeds this number, it may be considered harmful to the system.
const MAX_ALLOWED_EMPTY_RETURNS: u8 = 20;

/// Uses [`WasmHost`](crate::wasm_host::WasmHost) to communicate with WASM byte source plugin.
pub struct PluginsByteSource {
    /// The actual byte source for each supported version in plugins API.
    source: PlugVerByteSource,
    /// Tracks the number of consecutive returns of read method with no data within.
    /// This helps prevent plugins from causing harm to the Chipmunk system by
    /// always returning no data for read calls without any errors.
    empty_count: u8,
}

/// Represents the plugin byte source for each supported version in plugins API.
pub enum PlugVerByteSource {
    Ver010(v0_1_0::bytesource::PluginByteSource),
}

impl PluginsByteSource {
    /// Loads the plugin and extract the needed plugin info if valid.
    pub async fn get_info(plugin_path: PathBuf) -> Result<PluginInfo, PluginError> {
        let (component, version) = Self::load(&plugin_path).await?;

        let plug_info = match version {
            SemanticVersion {
                major: 0,
                minor: 1,
                patch: 0,
            } => v0_1_0::bytesource::PluginByteSource::get_info(component).await?,
            invalid_version => {
                return Err(PluginHostInitError::PluginInvalid(format!(
                    "Plugin version {invalid_version} is not supported"
                ))
                .into())
            }
        };

        let plugin_info = PluginInfo {
            wasm_file_path: plugin_path,
            api_version: version,
            plugin_version: plug_info.version,
            config_schemas: plug_info.config_schemas,
            render_options: RenderOptions::ByteSource,
        };

        Ok(plugin_info)
    }

    /// Loads and validate a plugin returning the its [`Component`] and API [`SemanticVersion`]
    async fn load(
        plugin_path: impl AsRef<Path>,
    ) -> Result<(Component, SemanticVersion), PluginHostInitError> {
        let engine = get_wasm_host()
            .map(|host| &host.engine)
            .map_err(|err| PluginHostInitError::from(err.to_owned()))?;
        let plugin_path = plugin_path.as_ref();

        if !plugin_path.exists() {
            return Err(PluginHostInitError::IO("Plugin path doesn't exist".into()));
        }

        if !plugin_path.is_file() {
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

        Ok((component, version))
    }

    /// Initialize byte-source instance with the needed configuration to be used within sessions.
    pub async fn initialize(
        plugin_path: impl AsRef<Path>,
        general_config: &stypes::PluginByteSourceGeneralSettings,
        plugin_configs: Vec<stypes::PluginConfigItem>,
    ) -> Result<Self, PluginHostInitError> {
        let (component, version) = Self::load(&plugin_path).await?;

        match version {
            SemanticVersion {
                major: 0,
                minor: 1,
                patch: 0,
            } => {
                let source = v0_1_0::bytesource::PluginByteSource::initialize(
                    component,
                    general_config,
                    plugin_configs,
                )
                .await?;

                Ok(Self {
                    source: PlugVerByteSource::Ver010(source),
                    empty_count: 0,
                })
            }
            invalid_version => Err(PluginHostInitError::PluginInvalid(format!(
                "Plugin version {invalid_version} is not supported"
            ))),
        }
    }

    /// Calls the function read on the plugin with provided length return the read byte.
    async fn read_next(&mut self, len: usize) -> io::Result<Vec<u8>> {
        let res = match &mut self.source {
            PlugVerByteSource::Ver010(source) => source.read_next(len).await,
        };

        if res.as_ref().is_ok_and(|bytes| bytes.is_empty()) {
            self.empty_count += 1;
            if self.empty_count > MAX_ALLOWED_EMPTY_RETURNS {
                return Err(io::Error::new(
                    io::ErrorKind::WriteZero,
                    format!(
                        "Plugin byte source returned empty data more than \
                        {MAX_ALLOWED_EMPTY_RETURNS} times consecutively."
                    ),
                ));
            }
        } else {
            self.empty_count = 0;
        };

        res
    }
}

impl WasmPlugin for PluginsByteSource {
    fn get_type() -> PluginType {
        PluginType::ByteSource
    }

    async fn plugin_version(&mut self) -> Result<SemanticVersion, PluginError> {
        match &mut self.source {
            PlugVerByteSource::Ver010(source) => source.plugin_version().await,
        }
    }

    async fn get_config_schemas(
        &mut self,
    ) -> Result<Vec<stypes::PluginConfigSchemaItem>, PluginError> {
        match &mut self.source {
            PlugVerByteSource::Ver010(source) => source.get_config_schemas().await,
        }
    }
}

// PluginsByteSource implements Read trait so we can use it with `BinaryByteSource`
impl Read for PluginsByteSource {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let len = buf.len();

        let bytes = futures::executor::block_on(self.read_next(len))?;

        let results_len = bytes.len();

        buf[..results_len].copy_from_slice(&bytes);

        Ok(results_len)
    }
}
