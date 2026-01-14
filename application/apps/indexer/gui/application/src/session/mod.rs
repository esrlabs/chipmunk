//! This is the main module for session parts

use stypes::ComputationError;

use crate::session::{communication::UiHandle, types::ObserveOperation, ui::SessionInfo};

pub mod command;
pub mod communication;
pub mod error;
pub mod message;
pub mod service;
pub mod types;
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
    pub observe_op: ObserveOperation,
}
