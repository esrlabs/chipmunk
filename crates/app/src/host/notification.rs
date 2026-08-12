//! Application notification content and UI display policy.

use crate::{host::error::HostError, session::error::SessionError};

/// A queued application notification and its UI display policy.
#[derive(Debug)]
pub struct NotificationRequest {
    /// Notification content and severity.
    pub notification: AppNotification,
    /// UI surfaces on which to show the notification.
    pub display: NotificationDisplay,
}

#[derive(Debug)]
pub enum AppNotification {
    HostError(HostError),
    SessionError(SessionError),
    UiError(String),
    /// General error notification.
    Error(String),
    /// General warning notification.
    Warning(String),
    /// General info notification.
    Info(String),
}

/// UI surfaces on which a notification is shown.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotificationDisplay {
    HistoryAndBanner,
    BannerOnly,
}
