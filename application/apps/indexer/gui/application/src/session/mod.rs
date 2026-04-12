//! This is the main module for session parts

use std::sync::Arc;

use stypes::ComputationError;

use crate::{
    host::ui::storage::{RecentSessionRegistration, RecentSessionStateSnapshot},
    session::{communication::UiHandle, types::ObserveOperation, ui::SessionInfo},
};

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

/// Parameters required to construct one running session UI.
#[derive(Debug)]
pub struct InitSessionParams {
    /// Static session metadata used by the UI shell.
    pub session_info: SessionInfo,
    /// Stable identity of the recent-session entry owned by this live session.
    pub recent_source_key: Arc<str>,
    /// Whether the current source shape supports bookmark persistence.
    pub supports_bookmarks: bool,
    /// UI-side communication handles for this session.
    pub communication: UiHandle,
    /// Initial observe operation started with the session.
    pub observe_op: ObserveOperation,
}

/// Session creation output sent from the service layer to the host UI.
#[derive(Debug)]
pub struct SpawnedSession {
    /// Parameters used to construct the live session UI.
    pub params: InitSessionParams,
    /// Static recent-session metadata owned by the host.
    pub recent_registration: RecentSessionRegistration,
    /// Optional session state to restore on startup.
    pub restore_state: Option<RecentSessionStateSnapshot>,
}
