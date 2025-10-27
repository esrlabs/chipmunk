use crate::host::notification::AppNotification;
use tokio::sync::mpsc;

/// A handle to be passed between UI components to get access to
/// shared UI functions like notifications.
#[derive(Debug, Default)]
pub struct UiActions {
    pending_notifications: Vec<AppNotification>,
}

impl UiActions {
    pub fn add_notification(&mut self, notifi: AppNotification) {
        self.pending_notifications.push(notifi);
    }

    pub(super) fn drain_notifications(&mut self) -> impl Iterator<Item = AppNotification> {
        self.pending_notifications.drain(..)
    }

    /// Tries to send the command with the provided sender. In case it fails it will
    /// log and notify the UI about the error with appropriate messages.
    ///
    /// # Return
    ///
    /// `true` if the command has been successfully sent.
    pub fn try_send_command<T>(&mut self, sender: &mpsc::Sender<T>, command: T) -> bool
    where
        T: std::fmt::Debug,
    {
        use mpsc::error::TrySendError;
        let Err(err) = sender.try_send(command) else {
            return true;
        };

        match err {
            TrySendError::Full(msg) => {
                log::error!(
                    "Communication error while sending command from UI to core. Channel is full. Message: {msg:?}"
                );
                let err = "Communication Error: Request can't be sent. Please try again later.";
                self.add_notification(AppNotification::UiError(err.into()));
            }
            TrySendError::Closed(msg) => {
                log::error!(
                    "Communication error while sending command from UI to core. Channel is Closed. Message: {msg:?}"
                );
                let err = "Unrecoverable communication Error. Please restart the app.\n\
                        Please consider submitting a bug report regarding this issue.";
                self.add_notification(AppNotification::UiError(err.into()));
            }
        }

        false
    }
}
