//! This is the main module for session parts

use std::path::PathBuf;

use crate::session::{communication::UiHandle, data::SessionState, service::SessionService};

pub mod command;
pub mod communication;
pub mod data;
pub mod error;
pub mod event;
pub mod service;
pub mod ui;

#[derive(Debug, thiserror::Error)]
pub enum InitSessionError {
    #[error("IO error: {0}")]
    IO(#[from] std::io::Error),
}

#[derive(Debug)]
pub struct InitSessionParams {
    pub file_path: PathBuf,
    pub communication: UiHandle,
}

pub fn init_session(
    egui_ctx: egui::Context,
    path: PathBuf,
) -> Result<InitSessionParams, InitSessionError> {
    let state = SessionState::create(path.clone())?;

    let (ui_handle, service_handle) = communication::init(egui_ctx, state);

    SessionService::spwan(service_handle);

    let info = InitSessionParams {
        file_path: path,
        communication: ui_handle,
    };

    Ok(info)
}
