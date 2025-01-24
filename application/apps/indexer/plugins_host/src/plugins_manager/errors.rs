use std::io;

use stypes::{NativeError, NativeErrorKind, Severity};
use thiserror::Error;

use crate::wasm_host::WasmHostInitError;

#[derive(Debug, Error)]
pub enum InitError {
    #[error("Initialization of WASM host failed. {0}")]
    WasmHost(#[from] WasmHostInitError),
    #[error(transparent)]
    WasmRunTimeError(#[from] anyhow::Error),
    #[error("IO Error. {0}")]
    IO(#[from] io::Error),
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
