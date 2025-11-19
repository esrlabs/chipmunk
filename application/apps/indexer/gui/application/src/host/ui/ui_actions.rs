use std::path::PathBuf;

use crate::host::notification::AppNotification;
use tokio::{sync::mpsc, task::JoinHandle};

/// A handle to be passed between UI components to get access to
/// shared UI functions like notifications.
#[derive(Debug, Default)]
pub struct UiActions {
    pending_notifications: Vec<AppNotification>,
    file_dialog_handle: Option<JoinHandle<()>>,
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

    /// Spawns an asynchronous file picker dialog.
    ///
    /// If a file is selected, the provided closure `callback` is
    /// executed with the selected paths.
    pub fn spawn_file_dialog<F, Fut>(&mut self, callback: F)
    where
        F: FnOnce(Vec<PathBuf>) -> Fut + Send + 'static,
        Fut: Future<Output = ()> + Send + 'static,
    {
        assert!(
            self.file_dialog_handle.is_none(),
            "Dialog Join handle can't exist when new dialog is requested"
        );

        // From rfd docs: We need to start the file picker from the main thread
        // which is a requirement on some operating systems and only then move
        // its handle to another thread to avoid blocking the UI.
        let handle = rfd::AsyncFileDialog::new().pick_files();

        let join_handle = tokio::spawn(async move {
            if let Some(files) = handle.await {
                log::trace!("Open file dialog return with {files:?}");

                if files.is_empty() {
                    return;
                }

                let files: Vec<PathBuf> = files.into_iter().map(|file| file.into()).collect();

                callback(files).await
            }
        });

        self.file_dialog_handle = Some(join_handle);
    }

    /// Checks if a file dialog is currently open and handles cleanup.
    pub fn check_has_file_dialog(&mut self) -> bool {
        if let Some(handle) = &self.file_dialog_handle {
            if handle.is_finished() {
                self.file_dialog_handle = None;
                return false;
            }

            return true;
        }

        false
    }
}
