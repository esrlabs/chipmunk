use uuid::Uuid;

/// Actions to be sent to the host directly from other UI parts without
/// including either host or session service.
#[derive(Debug)]
pub enum HostAction {
    /// Request the host to close a specific session
    CloseSession(Uuid),
}
