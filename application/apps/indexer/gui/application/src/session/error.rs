use stypes::NativeError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SessionError {
    #[error("Core Error: {0}")]
    NativeError(NativeError),
}
