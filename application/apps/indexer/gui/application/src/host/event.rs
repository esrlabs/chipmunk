use crate::session::InitSessionParams;

/// Events related to general app to be sent from Core to UI.
#[derive(Debug)]
pub enum HostEvent {
    CreateSession(InitSessionParams),
    /// Close the application.
    Close,
}
