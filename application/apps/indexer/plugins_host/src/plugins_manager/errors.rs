use thiserror::Error;

use crate::wasm_host::WasmHostInitError;

#[derive(Debug, Error)]
pub enum InitError {
    #[error("Initialization of WASM host failed. {0}")]
    WasmHost(#[from] WasmHostInitError),
    #[error(transparent)]
    WasmRunTimeError(#[from] anyhow::Error),
    #[error("Error during initialization. {0}")]
    Other(String),
}
