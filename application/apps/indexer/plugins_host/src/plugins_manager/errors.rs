use std::io;

use stypes::{NativeError, NativeErrorKind, Severity};
use thiserror::Error;

use crate::wasm_host::WasmHostInitError;

/// Plugins manager initialization Error.
#[derive(Debug, Error)]
pub enum InitError {
    /// Errors while initializing wasm host for plugins.
    #[error("Initialization of WASM host failed. {0}")]
    WasmHost(#[from] WasmHostInitError),
    /// Errors from WASM runtime.
    #[error(transparent)]
    WasmRunTimeError(#[from] anyhow::Error),
    /// IO Errors.
    #[error("IO Error. {0}")]
    IO(#[from] io::Error),
    /// Errors not included in the other error types.
    #[error("Error during initialization. {0}")]
    Other(String),
}

impl From<InitError> for NativeError {
    fn from(err: InitError) -> Self {
        Self {
            severity: Severity::ERROR,
            kind: NativeErrorKind::Plugins,
            message: Some(err.to_string()),
        }
    }
}
