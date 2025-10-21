use uuid::Uuid;

use crate::session::InitSessionParams;

/// Events related to general app to be sent from Core to UI.
#[derive(Debug)]
pub enum HostEvent {
    CreateSession(InitSessionParams),
    CloseSession {
        session_id: Uuid,
    },
    /// Close the application.
    Close,
}
