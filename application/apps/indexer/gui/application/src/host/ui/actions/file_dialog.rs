use std::path::PathBuf;

use tokio::{runtime::Handle, sync::oneshot};

#[derive(Debug)]
pub struct FileDialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

impl FileDialogFilter {
    pub fn new(name: impl Into<String>, extensions: Vec<String>) -> Self {
        Self {
            name: name.into(),
            extensions,
        }
    }
}

#[derive(Debug)]
pub struct FileDialogOutput {
    pub files: Vec<PathBuf>,
    pub id: String,
}

/// Manages the state and execution of asynchronous file dialogs via a Tokio runtime.
///
/// # Why Asynchronous?
///
/// While `rfd` provides simple blocking APIs (e.g., `FileDialog::pick_file`), using them
/// on the main thread stops the application's event loop. On Linux (GNOME/KDE), if the
/// main loop is blocked for too long, the window manager stops receiving "heartbeat"
/// events and assumes the application has frozen, prompting the user to "Force Quit".
///
/// This handle solves that by spawning the dialog on a background thread, keeping the
/// main UI thread responsive and creating a better user experience.
#[derive(Debug)]
pub struct FileDialogHandle {
    /// Handle to the tokio runtime to be used with spawning file dialog.
    tokio_handle: Handle,
    /// Receiver for the pending file dialog task.
    dialog_task_rx: Option<oneshot::Receiver<FileDialogOutput>>,
    /// Buffered output from the finished file dialog, waiting to be taken.
    dialog_output: Option<FileDialogOutput>,
}

impl FileDialogHandle {
    pub fn new(tokio_handle: Handle) -> Self {
        Self {
            tokio_handle,
            dialog_task_rx: None,
            dialog_output: None,
        }
    }

    /// Spawns a new asynchronous file picker dialog.
    ///
    /// This method initializes the dialog builder on the current thread and spawns
    /// the waiting task onto the configured Tokio runtime.
    ///
    /// To retrieve the results of the dialog, you must subsequently call [`Self::take_output`].
    pub fn pick_files(&mut self, id: impl Into<String>, filters: &[FileDialogFilter]) {
        debug_assert!(
            self.dialog_task_rx.is_none(),
            "Dialog Join handle can't exist when new dialog is requested"
        );

        let id = id.into();

        // From rfd docs: We need to start the file picker from the main thread
        // which is a requirement on some operating systems and only then move
        // its handle to another thread to avoid blocking the UI.
        let mut dialog = rfd::AsyncFileDialog::new();
        for filter in filters {
            dialog = dialog.add_filter(&filter.name, &filter.extensions);
        }

        let file_handle = dialog.pick_files();

        let (files_tx, files_rx) = oneshot::channel();

        self.tokio_handle.spawn(async move {
            let files = file_handle
                .await
                .map(|files| files.into_iter().map(|file| file.into()).collect())
                .unwrap_or_default();

            let output = FileDialogOutput { files, id };
            files_tx.send(output).ok();
        });

        self.dialog_task_rx = Some(files_rx);
    }

    /// Polls the background task to check if the user has selected files.
    ///
    /// If the dialog has finished, this method moves the result from the receiver
    /// into the internal `output` buffer and returns `false` (dialog is closed).
    /// If the dialog is still open, it returns `true`.
    pub fn poll_dialog_task(&mut self) -> bool {
        if let Some(rc) = self.dialog_task_rx.as_mut() {
            if let Ok(data) = rc.try_recv() {
                self.dialog_output = Some(data);
                self.dialog_task_rx = None;
                return false;
            } else {
                return true;
            }
        }

        false
    }

    /// Consumes and returns the result of the file dialog if the IDs match.
    pub fn take_output(&mut self, id: &str) -> Option<Vec<PathBuf>> {
        if let Some(data) = self.dialog_output.take() {
            if data.id.as_str() == id {
                Some(data.files)
            } else {
                self.dialog_output = Some(data);
                None
            }
        } else {
            None
        }
    }
}
