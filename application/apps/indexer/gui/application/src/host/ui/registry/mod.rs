pub mod filters;

use filters::FilterRegistry;
use uuid::Uuid;

/// Global registry for all shared state across sessions.
#[derive(Debug, Default)]
pub struct HostRegistry {
    pub filters: FilterRegistry,
}

impl HostRegistry {
    /// Cleanup all usage records for a closing session.
    pub fn cleanup_session(&mut self, session_id: &Uuid) {
        self.filters.cleanup_session(session_id);
    }
}
