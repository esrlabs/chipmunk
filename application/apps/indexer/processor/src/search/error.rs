use crate::grabber::GrabError;
use log::error;
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
pub enum SearchError {
    #[error("Configuration error ({0})")]
    Config(String),
    #[error("Channel-Communication error ({0})")]
    Communication(String),
    #[error("IO error while grabbing: ({0})")]
    IoOperation(String),
    #[error("Regex-Error: ({0})")]
    Regex(String),
    //Regex(#[from] grep_regex::Error),
    #[error("Input-Error: ({0})")]
    Input(String),
    #[error("GrabError error ({0})")]
    Grab(#[from] GrabError),
    #[error("Aborted: ({0})")]
    Aborted(String),
}
