use prost::DecodeError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum E {
    #[error("Missed field {0}")]
    MissedField(String),
    #[error("Invalid value of: {0}")]
    InvalidValue(String),
    #[error("Decoding error: {0}")]
    DecodeError(DecodeError),
}

impl From<DecodeError> for E {
    fn from(err: DecodeError) -> Self {
        E::DecodeError(err)
    }
}