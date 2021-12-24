pub mod binary;
pub mod session;

use thiserror::Error as ThisError;

#[derive(ThisError, Debug)]
pub enum Error {
    #[error("IO error: {0}")]
    IO(String),
    #[error("System time error: {0}")]
    SysTime(String),
    #[error("Channel error: {0}")]
    Channel(String),
}
