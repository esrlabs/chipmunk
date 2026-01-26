use uuid::Uuid;

use crate::{
    host::ui::{multi_setup::state::MultiFileState, session_setup::state::SessionSetupState},
    session::InitSessionParams,
};

/// Messages sent from the host service to the UI.
#[derive(Debug)]
pub enum HostMessage {
    /// Open Session Setup with the provided state.
    SessionSetupOpened(SessionSetupState),
    /// Close session setup with the provided id.
    SessionSetupClosed { id: Uuid },
    /// Close multiple files setup with the provided id.
    MultiSetupClose { id: Uuid },

    /// A new session has been successfully created.
    SessionCreated {
        session_params: InitSessionParams,
        /// ID for session_setup used to create this session to replace its tab
        /// instead of creating a new tab for the session.
        session_setup_id: Option<Uuid>,
    },
    /// Open Session Setup for concatenating files.
    MultiFilesSetup(MultiFileState),
    /// Host service has finished shutting down; the UI should now exit.
    Shutdown,
}
