//! This is the main module for session parts

use stypes::{ComputationError, ObserveOptions};
use uuid::Uuid;

use crate::session::{
    communication::{SharedSenders, UiHandle},
    info::SessionInfo,
    service::SessionService,
};

pub mod command;
pub mod communication;
pub mod data;
pub mod error;
pub mod event;
pub mod info;
pub mod service;
pub mod ui;

#[derive(Debug, thiserror::Error)]
pub enum InitSessionError {
    #[error("IO error: {0}")]
    IO(#[from] std::io::Error),
    #[error("Computation Error: {0}")]
    Computation(#[from] ComputationError),
    #[error("{0}")]
    Other(String),
}

#[derive(Debug)]
pub struct InitSessionParams {
    pub session_info: SessionInfo,
    pub communication: UiHandle,
}

pub async fn init_session(
    shared_senders: SharedSenders,
    options: ObserveOptions,
) -> Result<InitSessionParams, InitSessionError> {
    let session_id = Uuid::new_v4();

    let (ui_handle, service_handle) = communication::init(session_id, shared_senders);
    let session_info = SessionService::spawn(session_id, service_handle, options).await?;

    let info = InitSessionParams {
        session_info,
        communication: ui_handle,
    };

    Ok(info)
}
