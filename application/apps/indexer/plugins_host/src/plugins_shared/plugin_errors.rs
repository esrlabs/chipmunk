use stypes::{NativeError, NativeErrorKind, Severity};
use thiserror::Error;

use crate::wasm_host::WasmHostInitError;

/// Error related to plugins host.
#[derive(Debug, Error)]
pub enum PluginHostError {
    /// Error in WASM engine host.
    #[error("Error while initializing WASM Engine. {0}")]
    EngineError(#[from] WasmHostInitError),
    /// Plugins is invalid.
    #[error("Validating the plugin while loading failed. {0}")]
    PluginInvalid(String),
    #[error("Error reported from the plugin. {0}")]
    /// Error reported from the plugin when calling initialize method on it with
    /// the provided configurations.
    GuestError(PluginGuestError),
    /// IO Error while initializing the plugin.
    #[error("IO Error while initializing WASM Plugin. {0}")]
    IO(String),
    /// Error form WASM runtime.
    #[error(transparent)]
    WasmRunTimeError(#[from] anyhow::Error),
}

impl From<PluginHostError> for NativeError {
    fn from(err: PluginHostError) -> Self {
        NativeError {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Plugins,
            message: Some(format!("Plugin Host Error: {err}")),
        }
    }
}

/// Error reported from plugins guest.
#[derive(Debug, Error)]
pub enum PluginGuestError {
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
    /// Error related to plugins host.
    #[error("Plugins Host Error: {0}")]
    PluginHostError(#[from] PluginHostError),
    /// Error form WASM runtime.
    #[error(transparent)]
    WasmRunTimeError(#[from] anyhow::Error),
}
