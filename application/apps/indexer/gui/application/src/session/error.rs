use stypes::{ComputationError, NativeError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SessionError {
    #[error("Core Error: {0}")]
    NativeError(NativeError),
    #[error("Core Computation Error: {0}")]
    CompuationError(#[from] ComputationError),
}
