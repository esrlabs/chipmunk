use stypes::NearestPosition;

/// Messages sent to Session UI form services.
#[derive(Debug, Clone)]
pub enum SessionMessage {
    /// Nearest position jump to in the search table.
    NearestPosition(NearestPosition),
}
