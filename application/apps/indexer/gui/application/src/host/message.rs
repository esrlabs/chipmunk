use uuid::Uuid;

use crate::{
    host::{
        common::dlt_stats::DltStatistics,
        ui::{multi_setup::state::MultiFileState, session_setup::state::SessionSetupState},
    },
    session::InitSessionParams,
};

/// Messages sent from the host service to the UI.
#[derive(Debug)]
pub enum HostMessage {
    /// Open Session Setup with the provided state.
    SessionSetupOpened(Box<SessionSetupState>),
    /// Close session setup with the provided id.
    SessionSetupClosed { id: Uuid },
    /// Close multiple files setup with the provided id.
    MultiSetupClose { id: Uuid },
    /// The collected DLT statistics on a file for a SessionSetup
    DltStatistics {
        setup_session_id: Uuid,
        statistics: Option<Box<DltStatistics>>,
    },
    /// A new session has been successfully created.
    SessionCreated {
        session_params: Box<InitSessionParams>,
        /// ID for session_setup used to create this session to replace its tab
        /// instead of creating a new tab for the session.
        session_setup_id: Option<Uuid>,
    },
    /// Open Session Setup for concatenating files.
    MultiFilesSetup(Box<MultiFileState>),
}
