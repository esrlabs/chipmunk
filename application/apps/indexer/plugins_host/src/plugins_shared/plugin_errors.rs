use stypes::{NativeError, NativeErrorKind, Severity};
use thiserror::Error;

use crate::wasm_host::WasmHostInitError;

/// Initialization error of the host of a specific plugin.
#[derive(Debug, Error)]
pub enum PluginHostInitError {
    /// Error in WASM engine host.
    #[error("Error while initializing WASM Engine. {0}")]
    EngineError(#[from] WasmHostInitError),
    /// Plugins is invalid.
    #[error("Validating the plugin while loading failed. {0}")]
    PluginInvalid(String),
    #[error("Error reported from the plugin. {0}")]
    /// Error reported from the plugin when calling initialize method on it with
    /// the provided configurations.
    GuestError(PluginGuestInitError),
    /// IO Error while initializing the plugin.
    #[error("IO Error while initializing WASM Plugin. {0}")]
    IO(String),
    /// Error form WASM runtime.
    #[error(transparent)]
    WasmRunTimeError(#[from] anyhow::Error),
}

impl From<PluginHostInitError> for NativeError {
    fn from(err: PluginHostInitError) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Plugins,
            message: Some(format!("Plugin initializations failed. Error: {err}")),
        }
    }
}

/// Error reported from the plugin guest while calling initialization.
#[derive(Debug, Error)]
pub enum PluginGuestInitError {
    /// Plugin configuration error. Configurations can be the defined one by the plugin
    /// itself or one of general configurations.
    #[error("Configuration Error: {0}")]
    Config(String),
    /// IO operation error.
    #[error("IO Error: {0}")]
    IO(String),
    /// Unsupported error.
    #[error("Unsupported Error: {0}")]
    Unsupported(String),
    /// Errors not included in the other error types.
    #[error("Error: {0}")]
    Other(String),
}

/// Represents general errors in communication with plugins.
#[derive(Debug, Error)]
pub enum PluginError {
    /// Error while initialization wasm host for the plugin.
    #[error("Error while initializing plugin host. {0}")]
    HostInitError(#[from] PluginHostInitError),
    /// Error form WASM runtime.
    #[error(transparent)]
    WasmRunTimeError(#[from] anyhow::Error),
}
