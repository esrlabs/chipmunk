use std::io;

use stypes::{NativeError, NativeErrorKind, Severity};
use thiserror::Error;

use crate::{wasm_host::WasmHostInitError, PluginHostError};

/// Plugins manager initialization Error.
#[derive(Debug, Error)]
pub enum PluginsManagerError {
    /// Errors while initializing wasm host for plugins.
    #[error("Initialization of WASM host failed. {0}")]
    WasmHostInit(#[from] WasmHostInitError),
    /// Error related to plugins host.
    #[error("Plugins Host Error: {0}")]
    PluginHost(#[from] PluginHostError),
    /// Errors from WASM runtime.
    #[error(transparent)]
    WasmRunTimeError(#[from] anyhow::Error),
    /// Errors from plugins cache manager.
    #[error("Plugin cache error: {0}")]
    PluginsCache(#[from] PluginsCacheError),
    /// IO Errors.
    #[error("IO Error. {0}")]
    IO(#[from] io::Error),
    /// Errors not included in the other error types.
    #[error("Error during initialization. {0}")]
    Other(String),
}

impl From<PluginsManagerError> for NativeError {
    fn from(err: PluginsManagerError) -> Self {
        Self {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Plugins,
            message: Some(err.to_string()),
        }
    }
}

/// Errors related to plugin caching.
#[derive(Debug, Error)]
pub enum PluginsCacheError {
    /// IO Errors.
    #[error("IO Error. {0}")]
    IO(#[from] io::Error),
    /// Errors regarding serialization the cache into/from cache file.
    #[error("Serialization error. {0}")]
    Serialization(#[from] serde_json::Error),
    /// Error while calculating hash of plugin binary
    #[error("Error while calculating hash of plugin binary: {0}")]
    Hash(#[from] dir_checksum::HashError),
    /// Errors not included in the other error types.
    #[error("Plugins Caching Error: {0}")]
    Other(String),
}
