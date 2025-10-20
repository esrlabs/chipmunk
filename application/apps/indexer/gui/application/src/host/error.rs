use stypes::NativeError;
use thiserror::Error;

use crate::{host::event::HostEvent, session::InitSessionError};

#[derive(Debug, Error)]
pub enum HostError {
    #[error("Session initialization error: {0}")]
    InitSessionError(#[from] InitSessionError),
    //TODO AAZ: This can't be sent to the UI. I need to move this form here or
    //have another struct to be sent to UI.
    #[error("Error while sending app event to UI")]
    SendEvent(HostEvent),
    //TODO AAZ: Debug print the error for now
    #[error("Core Error: severity {:?}, kind {:?}, msg {}", 
        .0.severity, .0.kind, .0.message.as_deref().unwrap_or_default())]
    NativeError(NativeError),
}
