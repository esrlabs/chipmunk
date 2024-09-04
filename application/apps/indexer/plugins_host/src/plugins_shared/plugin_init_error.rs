use thiserror::Error;

use crate::wasm_host::WasmHostInitError;

#[derive(Debug, Error)]
pub enum PluginHostInitError {
    #[error("Error while initializing WASM Engine. {0}")]
    EngineError(#[from] WasmHostInitError),
    #[error("Validating the plugin while loading failed. {0}")]
    PluginInvalid(String),
    #[error("Error reported from the plugin. {0}")]
    GuestError(PluginGuestInitError),
    #[error("IO Error while initializing WASM Plugin. {0}")]
    IO(String),
    #[error(transparent)]
    WasmRunTimeError(#[from] anyhow::Error),
}

#[derive(Debug, Error)]
pub enum PluginGuestInitError {
    #[error("Configuration Error: {0}")]
    Config(String),
    #[error("IO Error: {0}")]
    IO(String),
    #[error("Unsupported Error: {0}")]
    Unsupported(String),
    #[error("Error: {0}")]
    Other(String),
}
