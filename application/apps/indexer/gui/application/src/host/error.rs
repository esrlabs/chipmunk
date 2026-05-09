use plugins_host::plugins_manager::PluginsManagerError;
use stypes::NativeError;
use thiserror::Error;

use crate::session::InitSessionError;

#[allow(unused)]
#[derive(Debug, Error)]
pub enum HostError {
    #[error("Session initialization error: {0}")]
    InitSessionError(#[from] InitSessionError),
    #[error("Core Error: {0}")]
    NativeError(NativeError),
}

impl From<PluginsManagerError> for HostError {
    fn from(err: PluginsManagerError) -> Self {
        Self::NativeError(err.into())
    }
}
