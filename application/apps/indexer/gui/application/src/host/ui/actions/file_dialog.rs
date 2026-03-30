use std::{future::Future, path::PathBuf};

use tokio::{
    runtime::Handle,
    sync::oneshot::{self, error::TryRecvError},
};

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

/// Builder-style configuration for native file dialogs.
///
/// The same options bag is shared across open, folder, and save dialogs.
/// Some options are ignored by dialog kinds that do not support them.
#[derive(Debug, Default)]
pub struct FileDialogOptions {
    title: Option<String>,
    directory: Option<PathBuf>,
    file_name: Option<String>,
    filters: Vec<FileDialogFilter>,
}

impl FileDialogOptions {
    /// Creates an empty dialog configuration.
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets the native dialog window title.
    pub fn title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }

    /// Sets the initial directory shown when the dialog opens.
    pub fn directory(mut self, directory: impl Into<PathBuf>) -> Self {
        self.directory = Some(directory.into());
        self
    }

    #[allow(dead_code)]
    /// Sets the suggested output file name for save dialogs.
    pub fn file_name(mut self, file_name: impl Into<String>) -> Self {
        self.file_name = Some(file_name.into());
        self
    }

    /// Appends a single extension filter to the dialog.
    pub fn filter(mut self, filter: FileDialogFilter) -> Self {
        self.filters.push(filter);
        self
    }

    /// Replaces all dialog filters with the provided set.
    pub fn filters(mut self, filters: Vec<FileDialogFilter>) -> Self {
        self.filters = filters;
        self
    }
}

#[derive(Debug)]
pub struct FileDialogOutput {
    pub paths: Vec<PathBuf>,
    pub id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DialogTaskState {
    Pending,
    Finished,
}

impl DialogTaskState {
    pub fn is_pending(self) -> bool {
        self == Self::Pending
    }
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
    pub fn pick_files(&mut self, id: impl Into<String>, options: FileDialogOptions) {
        let id = id.into();

        // From rfd docs: We need to start the file picker from the main thread
        // which is a requirement on some operating systems and only then move
        // its handle to another thread to avoid blocking the UI.
        let file_handle = Self::apply_options(rfd::AsyncFileDialog::new(), options).pick_files();

        self.spawn_dialog_task(id, async move {
            file_handle
                .await
                .map(|files| files.into_iter().map(|file| file.into()).collect())
                .unwrap_or_default()
        });
    }

    /// Spawns a new asynchronous single-file picker dialog.
    ///
    /// This method initializes the dialog builder on the current thread and spawns
    /// the waiting task onto the configured Tokio runtime.
    ///
    /// To retrieve the result of the dialog, you must subsequently call [`Self::take_output`].
    pub fn pick_file(&mut self, id: impl Into<String>, options: FileDialogOptions) {
        let id = id.into();

        let file_handle = Self::apply_options(rfd::AsyncFileDialog::new(), options).pick_file();

        self.spawn_dialog_task(id, async move {
            file_handle.await.map(PathBuf::from).into_iter().collect()
        });
    }

    /// Spawns a new asynchronous folder picker dialog.
    ///
    /// This method initializes the dialog builder on the current thread and spawns
    /// the waiting task onto the configured Tokio runtime.
    ///
    /// To retrieve the results of the dialog, you must subsequently call [`Self::take_output`].
    pub fn pick_folder(&mut self, id: impl Into<String>, options: FileDialogOptions) {
        let id = id.into();

        // From rfd docs: We need to start the file picker from the main thread
        // which is a requirement on some operating systems and only then move
        // its handle to another thread to avoid blocking the UI.
        let dir_handle = Self::apply_options(rfd::AsyncFileDialog::new(), options).pick_folder();

        self.spawn_dialog_task(id, async move {
            dir_handle.await.map(PathBuf::from).into_iter().collect()
        });
    }

    /// Spawns a new asynchronous save file dialog.
    ///
    /// This method initializes the dialog builder on the current thread and spawns
    /// the waiting task onto the configured Tokio runtime.
    ///
    /// To retrieve the result of the dialog, you must subsequently call [`Self::take_output`].
    #[allow(dead_code)]
    pub fn save_file(&mut self, id: impl Into<String>, options: FileDialogOptions) {
        let id = id.into();

        // From rfd docs: We need to start the file picker from the main thread
        // which is a requirement on some operating systems and only then move
        // its handle to another thread to avoid blocking the UI.
        let file_handle = Self::apply_options(rfd::AsyncFileDialog::new(), options).save_file();

        self.spawn_dialog_task(id, async move {
            file_handle.await.map(PathBuf::from).into_iter().collect()
        });
    }

    fn apply_options(
        mut dialog: rfd::AsyncFileDialog,
        options: FileDialogOptions,
    ) -> rfd::AsyncFileDialog {
        let FileDialogOptions {
            title,
            directory,
            file_name,
            filters,
        } = options;

        if let Some(title) = title {
            dialog = dialog.set_title(title);
        }

        if let Some(directory) = directory {
            dialog = dialog.set_directory(directory);
        }

        if let Some(file_name) = file_name {
            dialog = dialog.set_file_name(file_name);
        }

        for filter in filters {
            dialog = dialog.add_filter(&filter.name, &filter.extensions);
        }

        dialog
    }

    fn spawn_dialog_task<F>(&mut self, id: String, dialog_future: F)
    where
        F: Future<Output = Vec<PathBuf>> + Send + 'static,
    {
        debug_assert!(
            self.dialog_task_rx.is_none(),
            "Dialog Join handle can't exist when new dialog is requested"
        );

        let (files_tx, files_rx) = oneshot::channel();

        self.tokio_handle.spawn(async move {
            let output = FileDialogOutput {
                paths: dialog_future.await,
                id,
            };
            files_tx.send(output).ok();
        });

        self.dialog_task_rx = Some(files_rx);
    }

    /// Polls the background task to check if the user has selected files.
    ///
    /// If the dialog is still open, this returns [`DialogTaskState::Pending`].
    /// Once the dialog completes or its task is dropped, it returns
    /// [`DialogTaskState::Finished`] and clears the pending receiver.
    pub fn poll_dialog_task(&mut self) -> DialogTaskState {
        let Some(rc) = self.dialog_task_rx.as_mut() else {
            return DialogTaskState::Finished;
        };

        match rc.try_recv() {
            Ok(data) => {
                self.dialog_output = Some(data);
                self.dialog_task_rx = None;
                DialogTaskState::Finished
            }
            Err(TryRecvError::Empty) => DialogTaskState::Pending,
            Err(TryRecvError::Closed) => {
                self.dialog_task_rx = None;
                DialogTaskState::Finished
            }
        }
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
    fn poll_finishes_without_task() {
        let rt = Runtime::new().unwrap();
        let mut handle = FileDialogHandle::new(rt.handle().clone());

        assert_eq!(handle.poll_dialog_task(), DialogTaskState::Finished);
        assert!(handle.dialog_output.is_none());
    }

    #[test]
    fn poll_reports_pending_dialog() {
        let rt = Runtime::new().unwrap();
        let mut handle = FileDialogHandle::new(rt.handle().clone());
        let (_tx, rx) = oneshot::channel::<FileDialogOutput>();
        handle.dialog_task_rx = Some(rx);

        assert_eq!(handle.poll_dialog_task(), DialogTaskState::Pending);
        assert!(handle.dialog_task_rx.is_some());
        assert!(handle.dialog_output.is_none());
    }

    #[test]
    fn poll_buffers_completed_dialog() {
        let rt = Runtime::new().unwrap();
        let mut handle = FileDialogHandle::new(rt.handle().clone());
        let (tx, rx) = oneshot::channel();
        handle.dialog_task_rx = Some(rx);

        tx.send(FileDialogOutput {
            paths: vec![PathBuf::from("/tmp/test")],
            id: "test_dialog".to_string(),
        })
        .unwrap();

        assert_eq!(handle.poll_dialog_task(), DialogTaskState::Finished);
        assert!(handle.dialog_task_rx.is_none());
        assert_eq!(handle.dialog_output.as_ref().unwrap().id, "test_dialog");
    }

    #[test]
    fn poll_finishes_dropped_dialog() {
        let rt = Runtime::new().unwrap();
        let mut handle = FileDialogHandle::new(rt.handle().clone());
        let (tx, rx) = oneshot::channel::<FileDialogOutput>();
        handle.dialog_task_rx = Some(rx);
        drop(tx);

        assert_eq!(handle.poll_dialog_task(), DialogTaskState::Finished);
        assert!(handle.dialog_task_rx.is_none());
        assert!(handle.dialog_output.is_none());
    }

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
