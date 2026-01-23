use uuid::Uuid;

use crate::{host::error::HostError, session::error::SessionError};

#[allow(unused)]
#[derive(Debug)]
pub enum AppNotification {
    HostError(HostError),
    SessionError {
        session_id: Uuid,
        error: SessionError,
    },
    UiError(String),
    /// General error notification.
    Error(String),
    /// General warning notification.
    Warning(String),
    /// General info notification.
    Info(String),
}
