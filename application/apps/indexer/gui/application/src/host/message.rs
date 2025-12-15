use uuid::Uuid;

use crate::{host::ui::session_setup::state::SessionSetupState, session::InitSessionParams};

/// Messages sent from the host service to the UI.
#[derive(Debug)]
pub enum HostMessage {
    /// Open Session Setup with the provided state.
    SessionSetupOpened(SessionSetupState),
    /// Close session setup with the provided id.
    SessionSetupClosed { id: Uuid },

    /// A new session has been successfully created.
    SessionCreated {
        session_info: InitSessionParams,
        /// ID for session_setup used to create this session to replace its tab
        /// instead of creating a new tab for the session.
        session_setup_id: Option<Uuid>,
    },
    /// An existing session has been terminated.
    SessionClosed { session_id: Uuid },

    /// Host service has finished shutting down; the UI should now exit.
    Shutdown,
}
