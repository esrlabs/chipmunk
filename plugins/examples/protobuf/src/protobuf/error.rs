use crate::*;
use thiserror::Error;

/// Internal error type for the parser.
///
/// This error is used internally and does not propagate beyond the trait boundary.
/// It represents failures related to descriptor loading and I/O operations.
#[derive(Error, Debug)]
pub enum E {
    /// Error encountered while processing the descriptor.
    #[error("DescriptorError: {0}")]
    Descriptor(#[from] prost_reflect::DescriptorError),

    /// Error related to input/output operations.
    #[error("IO: {0}")]
    Io(#[from] std::io::Error),
}

impl From<E> for InitError {
    /// Converts an internal parser error (`E`) into an `InitError` type.
    fn from(err: E) -> Self {
        InitError::Other(err.to_string())
    }
}
