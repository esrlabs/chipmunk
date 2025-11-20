use uuid::Uuid;

use crate::session::InitSessionParams;

/// Messages sent from the host service to the UI.
#[derive(Debug)]
pub enum HostMessage {
    /// A new session has been successfully created.
    SessionCreated(InitSessionParams),
    /// An existing session has been terminated.
    SessionClosed { session_id: Uuid },

    /// Host service has finished shutting down; the UI should now exit.
    Shutdown,
}
