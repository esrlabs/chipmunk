use thiserror::Error;

#[derive(Error, Debug)]
pub enum HashError {
    #[error("Environment error, cannot continue: {0}")]
    Environment(String),
    #[error("Entry could not be processed: {0}")]
    Entry(String),
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
}
