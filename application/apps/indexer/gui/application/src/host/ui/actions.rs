use std::{path::PathBuf, time::Duration};

use crate::host::notification::AppNotification;
use tokio::{runtime::Handle, sync::mpsc, task::JoinHandle};

/// A handle to be passed between UI components to get access to
/// shared UI functions like notifications.
#[derive(Debug)]
pub struct UiActions {
    /// Handle to the tokio runtime which is running on the services threads.
    /// This is useful to bridge between the sync UI main thread and the async
    /// services runtime
    pub tokio_handle: Handle,
    pending_notifications: Vec<AppNotification>,
    file_dialog_handle: Option<JoinHandle<()>>,
}

impl UiActions {
    pub fn new(tokio_handle: Handle) -> Self {
        Self {
            tokio_handle,
            pending_notifications: Vec::new(),
            file_dialog_handle: None,
        }
    }

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

    /// Attempts to send a command via the provided sender with a retry mechanism.
    ///
    /// # Note: Blocking Operation
    /// This function uses `std::thread::sleep` to wait between attempts.
    /// **Avoid high `interval` or `max_attempts` values on the main UI thread**,
    /// as this will freeze the application interface.
    ///
    /// # Behavior
    /// * **Success:** Returns `true` immediately.
    /// * **Channel Full:** Retries up to `max_attempts`, waiting `interval` between tries.
    /// * **Channel Closed:** Fails immediately (no retry), as the receiver is unreachable.
    ///
    /// # Return
    /// * `true` if the command was successfully sent.
    /// * `false` if the channel was closed or remained full after all attempts.
    pub fn send_command_with_retry<T>(
        &mut self,
        sender: &mpsc::Sender<T>,
        command: T,
        interval: Duration,
        max_attempts: u8,
    ) -> bool
    where
        T: std::fmt::Debug,
    {
        use mpsc::error::TrySendError;

        let mut cmd = command;
        let mut attempts = 0;

        loop {
            match sender.try_send(cmd) {
                Ok(()) => return true,
                Err(err) => {
                    match err {
                        TrySendError::Full(returned_cmd) => {
                            if attempts >= max_attempts {
                                log::error!(
                                    "Communication error: Channel full after {} attempts. Dropping message: {:?}",
                                    attempts,
                                    returned_cmd
                                );
                                self.add_notification(AppNotification::UiError(
                                    "System Busy: Request timed out. Please try again.".into(),
                                ));
                                return false;
                            }

                            std::thread::sleep(interval);
                            cmd = returned_cmd;
                            attempts += 1;
                        }
                        TrySendError::Closed(returned_cmd) => {
                            // Do not retry on Disconnected/Closed. It will never succeed.
                            log::error!(
                                "Critical error: Core service disconnected. Dropping message: {:?}",
                                returned_cmd
                            );
                            let err_msg = "Critical Error: Connection to core service lost.\n\
                                           Please restart the application.";
                            self.add_notification(AppNotification::UiError(err_msg.into()));
                            return false;
                        }
                    }
                }
            }
        }
    }

    // TODO: Remove function or warning suppressing before final merge.
    #[allow(unused)]
    /// Sends the command with the provided sender using `blocking_send` method. In case it fails it will
    /// log and notify the UI about the error with appropriate messages.
    ///
    /// # Return
    ///
    /// `true` if the command has been successfully sent.
    pub fn blocking_send_command<T>(&mut self, sender: &mpsc::Sender<T>, command: T) -> bool
    where
        T: std::fmt::Debug,
    {
        if let Err(err) = sender.blocking_send(command) {
            log::error!(
                "Communication error while sending command from UI to core. Channel is Closed. Error: {err:?}"
            );

            let err = "Unrecoverable communication Error. Please restart the app.\n\
                        Please consider submitting a bug report regarding this issue.";
            self.add_notification(AppNotification::UiError(err.into()));

            return false;
        }

        true
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
        let file_handle = rfd::AsyncFileDialog::new().pick_files();

        let join_handle = self.tokio_handle.spawn(async move {
            if let Some(files) = file_handle.await {
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
