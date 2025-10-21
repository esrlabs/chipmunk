use stypes::NativeError;
use thiserror::Error;

use crate::session::InitSessionError;

#[derive(Debug, Error)]
pub enum HostError {
    #[error("Session initialization error: {0}")]
    InitSessionError(#[from] InitSessionError),
    #[error("Core Error: {0}")]
    NativeError(NativeError),
}
