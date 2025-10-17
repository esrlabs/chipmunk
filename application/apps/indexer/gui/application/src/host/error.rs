use thiserror::Error;

use crate::{host::event::HostEvent, session::InitSessionError};

#[derive(Debug, Error)]
pub enum HostError {
    #[error("Session initialization error: {0}")]
    InitSessionError(#[from] InitSessionError),
    #[error("Error while sending app event to UI")]
    SendEvent(HostEvent),
}
