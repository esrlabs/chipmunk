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

/// Session creation output sent from the service layer to the host UI.
#[derive(Debug)]
pub struct SpawnedSession {
    /// UI initialization payload for the live session.
    pub ui_init: SessionUiInit,
    /// Recent-session metadata still handled by the host.
    pub recent: SpawnedRecentSession,
}

/// Parameters required to construct one running session UI.
#[derive(Debug)]
pub struct SessionUiInit {
    /// Static session metadata used by the UI shell.
    pub session_info: SessionInfo,
    /// Recent-session runtime state owned by the live session.
    pub recent_runtime: RecentSessionRuntimeInit,
    /// UI-side communication handles for this session.
    pub communication: UiHandle,
    /// Initial observe operation started with the session.
    pub observe_op: ObserveOperation,
}

/// Recent-session runtime state needed by one live session.
#[derive(Debug)]
pub struct RecentSessionRuntimeInit {
    /// Stable identity of the recent-session entry owned by this live session.
    pub source_key: Arc<str>,
    /// Whether this source shape supports recent bookmark persistence.
    pub supports_bookmarks: bool,
    /// Additional startup observe operations attached before first render.
    pub additional_observe_ops: Vec<ObserveOperation>,
}

/// Host-owned recent-session data associated with a spawned session.
#[derive(Debug)]
pub struct SpawnedRecentSession {
    /// Static recent-session metadata owned by the host.
    pub registration: RecentSessionRegistration,
    /// Optional session state to restore on startup.
    pub restore_state: Option<RecentSessionStateSnapshot>,
}
