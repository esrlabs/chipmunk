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
    pub paths: Vec<PathBuf>,
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

            let output = FileDialogOutput { paths: files, id };
            files_tx.send(output).ok();
        });

        self.dialog_task_rx = Some(files_rx);
    }

    /// Spawns a new asynchronous folder picker dialog.
    ///
    /// This method initializes the dialog builder on the current thread and spawns
    /// the waiting task onto the configured Tokio runtime.
    ///
    /// To retrieve the results of the dialog, you must subsequently call [`Self::take_output`].
    pub fn pick_folder(&mut self, id: impl Into<String>) {
        debug_assert!(
            self.dialog_task_rx.is_none(),
            "Dialog Join handle can't exist when new dialog is requested"
        );

        let id = id.into();

        // From rfd docs: We need to start the file picker from the main thread
        // which is a requirement on some operating systems and only then move
        // its handle to another thread to avoid blocking the UI.
        let dir_handle = rfd::AsyncFileDialog::new().pick_folder();

        let (files_tx, files_rx) = oneshot::channel();

        self.tokio_handle.spawn(async move {
            let path = dir_handle.await.map(PathBuf::from);
            let files = match path {
                Some(p) => vec![p],
                None => Vec::new(),
            };

            let output = FileDialogOutput { paths: files, id };
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
                Some(data.paths)
            } else {
                self.dialog_output = Some(data);
                None
            }
        } else {
            None
        }
    }

    /// Consumes and returns the result of the file dialog if the dialog ID matches any of the provided IDs.
    ///
    /// Returns `Some((matched_id, paths))` if a match is found.
    /// Returns `None` if no match is found or if there is no pending output.
    pub fn take_output_many<'a>(&mut self, ids: &[&'a str]) -> Option<(&'a str, Vec<PathBuf>)> {
        let output = self.dialog_output.take()?;

        for id in ids {
            if output.id.as_str() == *id {
                return Some((id, output.paths));
            }
        }

        self.dialog_output = Some(output);
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::runtime::Runtime;

    #[test]
    fn test_take_output() {
        let rt = Runtime::new().unwrap();
        let mut handle = FileDialogHandle::new(rt.handle().clone());

        handle.dialog_output = Some(FileDialogOutput {
            paths: vec![PathBuf::from("/tmp/test")],
            id: "test_dialog".to_string(),
        });

        // Try taking with wrong ID
        assert!(handle.take_output("wrong_id").is_none());
        assert!(handle.dialog_output.is_some());

        // Try taking with correct ID
        let res = handle.take_output("test_dialog");
        assert!(res.is_some());
        assert_eq!(res.unwrap()[0], PathBuf::from("/tmp/test"));
        assert!(handle.dialog_output.is_none());
    }

    #[test]
    fn test_take_output_many() {
        let rt = Runtime::new().unwrap();
        let mut handle = FileDialogHandle::new(rt.handle().clone());

        handle.dialog_output = Some(FileDialogOutput {
            paths: vec![PathBuf::from("/tmp/test")],
            id: "target_id".to_string(),
        });

        // Try with no matches
        let ids = vec!["id1", "id2"];
        assert!(handle.take_output_many(&ids).is_none());
        assert!(handle.dialog_output.is_some());

        // Try with match
        let ids = vec!["id1", "target_id", "id3"];
        let res = handle.take_output_many(&ids);
        assert!(res.is_some());
        let (matched_id, paths) = res.unwrap();
        assert_eq!(matched_id, "target_id");
        assert_eq!(paths[0], PathBuf::from("/tmp/test"));
        assert!(handle.dialog_output.is_none());
    }
}