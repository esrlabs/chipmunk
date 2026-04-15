//! Storage domain state for file explorer favorite folders.

use std::path::{Path, PathBuf};

use super::{LoadState, SaveOutcome, StorageError};

/// UI-side storage state for file-explorer favorite folders.
#[derive(Debug)]
pub struct FileExplorerStorage {
    /// Current loaded file-explorer snapshot.
    pub state: LoadState<FileExplorerData>,
    /// True when the favorite-folder path list still needs to be saved.
    dirty: bool,
    next_scan_request_id: u64,
    /// Request currently waiting for a scan result.
    pub active_scan_request_id: Option<u64>,
    active_scan_marks_dirty: bool,
}

/// Runtime file-explorer storage data.
#[derive(Debug, Clone, Default)]
pub struct FileExplorerData {
    /// Favorite folders shown in the file explorer.
    pub favorite_folders: Vec<FavoriteFolder>,
}

/// One favorite folder and its currently scanned top-level files.
#[derive(Debug, Clone)]
pub struct FavoriteFolder {
    /// Directory path saved as a favorite.
    pub path: PathBuf,
    /// Runtime-only file list rebuilt by scanning the directory.
    pub files: Vec<FileUiInfo>,
}

/// File row data rendered under a favorite folder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileUiInfo {
    /// File name shown in the UI.
    pub name: String,
    /// Preformatted human-readable size text.
    pub size_txt: String,
}

/// Prepared scan request for favorite folders.
#[derive(Debug)]
pub struct FavoriteFoldersScanRequest {
    /// Local request identifier echoed back with the scan result.
    pub request_id: u64,
    /// Favorite-folder paths to scan.
    pub paths: Vec<PathBuf>,
}

impl FileExplorerStorage {
    /// Creates the domain in its initial loading state.
    pub fn new() -> Self {
        Self {
            state: LoadState::Loading,
            dirty: false,
            next_scan_request_id: 1,
            active_scan_request_id: None,
            active_scan_marks_dirty: false,
        }
    }

    /// Returns true when the ready snapshot already contains the provided favorite path.
    pub fn contains_favorite_folder(&self, path: &Path) -> bool {
        let LoadState::Ready(data) = &self.state else {
            return false;
        };

        data.favorite_folders
            .iter()
            .any(|folder| folder.path == path)
    }

    /// Returns the current snapshot only when the domain is ready and dirty.
    pub fn get_save_data(&self) -> Option<FileExplorerData> {
        if !self.dirty {
            return None;
        }

        let LoadState::Ready(data) = &self.state else {
            return None;
        };

        Some(data.clone())
    }

    /// Applies a load result, falling back to the default ready state on error.
    ///
    /// The error is returned to let the caller decide whether to notify the user.
    pub fn finish_load(
        &mut self,
        result: Result<Box<FileExplorerData>, StorageError>,
    ) -> Option<StorageError> {
        let (mut data, err) = match result {
            Ok(data) => (*data, None),
            Err(err) => (FileExplorerData::default(), Some(err)),
        };

        sort_favorite_folders(&mut data.favorite_folders);

        self.state = LoadState::Ready(data);
        self.dirty = false;
        self.active_scan_request_id = None;
        self.active_scan_marks_dirty = false;

        err
    }

    /// Starts one scan request when the domain is ready and idle.
    pub fn prepare_scan(&mut self, paths: Vec<PathBuf>) -> Option<FavoriteFoldersScanRequest> {
        self.prepare_scan_request(paths, false)
    }

    /// Starts one scan request that should mark the domain dirty on success.
    pub fn prepare_add_scan(&mut self, paths: Vec<PathBuf>) -> Option<FavoriteFoldersScanRequest> {
        self.prepare_scan_request(paths, true)
    }

    fn prepare_scan_request(
        &mut self,
        paths: Vec<PathBuf>,
        mark_dirty_on_success: bool,
    ) -> Option<FavoriteFoldersScanRequest> {
        if paths.is_empty() || self.active_scan_request_id.is_some() {
            return None;
        }

        let LoadState::Ready(_) = &self.state else {
            return None;
        };

        let request_id = self.next_scan_request_id;
        self.next_scan_request_id = self.next_scan_request_id.saturating_add(1);
        self.active_scan_request_id = Some(request_id);
        self.active_scan_marks_dirty = mark_dirty_on_success;

        Some(FavoriteFoldersScanRequest { request_id, paths })
    }

    /// Clears the active scan request after send failure or cancellation.
    pub fn clear_active_scan_request(&mut self) {
        self.active_scan_request_id = None;
        self.active_scan_marks_dirty = false;
    }

    /// Applies a matching scan result to the ready snapshot.
    pub fn finish_scan(
        &mut self,
        request_id: u64,
        result: Result<Vec<FavoriteFolder>, StorageError>,
    ) -> Option<StorageError> {
        if self.active_scan_request_id != Some(request_id) {
            return None;
        }

        let mark_dirty = self.active_scan_marks_dirty;
        self.clear_active_scan_request();

        match result {
            Ok(scanned_folders) => {
                let LoadState::Ready(data) = &mut self.state else {
                    return None;
                };

                upsert_favorite_folders(&mut data.favorite_folders, scanned_folders);
                sort_favorite_folders(&mut data.favorite_folders);
                self.dirty |= mark_dirty;
                None
            }
            Err(err) => Some(err),
        }
    }

    /// Removes one favorite folder path from the ready snapshot.
    pub fn remove_favorite_folder(&mut self, path: &Path) {
        let LoadState::Ready(data) = &mut self.state else {
            return;
        };

        let initial_len = data.favorite_folders.len();
        data.favorite_folders.retain(|folder| folder.path != path);
        self.dirty |= data.favorite_folders.len() != initial_len;
    }

    pub(super) fn apply_save_outcome(&mut self, outcome: SaveOutcome) {
        self.dirty = match outcome {
            SaveOutcome::Succeeded => false,
            SaveOutcome::Failed => true,
        };
    }
}

impl FavoriteFolder {
    /// Creates an empty favorite-folder snapshot for the provided path.
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            files: Vec::new(),
        }
    }
}

impl FileUiInfo {
    /// Creates one rendered file entry.
    pub fn new(name: String, size_txt: String) -> Self {
        Self { name, size_txt }
    }
}

fn upsert_favorite_folders(
    favorite_folders: &mut Vec<FavoriteFolder>,
    scanned: Vec<FavoriteFolder>,
) {
    for folder in scanned {
        if let Some(existing) = favorite_folders
            .iter_mut()
            .find(|existing| existing.path == folder.path)
        {
            *existing = folder;
        } else {
            favorite_folders.push(folder);
        }
    }
}

fn sort_favorite_folders(favorite_folders: &mut [FavoriteFolder]) {
    favorite_folders.sort_unstable_by(|left, right| left.path.cmp(&right.path));
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use super::{
        FavoriteFolder, FileExplorerData, FileExplorerStorage, FileUiInfo, LoadState, StorageError,
    };
    use crate::host::ui::storage::StorageErrorKind;

    fn test_storage() -> FileExplorerStorage {
        FileExplorerStorage::new()
    }

    fn folder(path: &str, file_names: &[&str]) -> FavoriteFolder {
        FavoriteFolder {
            path: PathBuf::from(path),
            files: file_names
                .iter()
                .map(|name| FileUiInfo::new((*name).into(), "1 B".into()))
                .collect(),
        }
    }

    #[test]
    fn finish_load_sorts_paths() {
        let mut storage = test_storage();

        let error = storage.finish_load(Ok(Box::new(FileExplorerData {
            favorite_folders: vec![folder("/b", &[]), folder("/a", &["first.log"])],
        })));

        assert!(error.is_none());
        assert!(!storage.dirty);
        assert!(matches!(
            storage.state,
            LoadState::Ready(FileExplorerData { favorite_folders })
                if favorite_folders.iter().map(|folder| folder.path.clone()).collect::<Vec<_>>()
                    == vec![PathBuf::from("/a"), PathBuf::from("/b")]
        ));
    }

    #[test]
    fn load_error_falls_back() {
        let mut storage = test_storage();

        let error = storage.finish_load(Err(StorageError {
            kind: StorageErrorKind::Parse,
            message: "bad json".into(),
        }));

        assert!(matches!(
            error,
            Some(StorageError {
                kind: StorageErrorKind::Parse,
                ..
            })
        ));
        assert!(matches!(
            storage.state,
            LoadState::Ready(FileExplorerData { favorite_folders }) if favorite_folders.is_empty()
        ));
    }

    #[test]
    fn prepare_scan_tracks_request() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(FileExplorerData::default())));

        let request = storage
            .prepare_scan(vec![PathBuf::from("/tmp")])
            .expect("scan request should be prepared");

        assert_eq!(request.request_id, 1);
        assert_eq!(request.paths, vec![PathBuf::from("/tmp")]);
        assert_eq!(storage.active_scan_request_id, Some(1));
    }

    #[test]
    fn finish_scan_ignores_stale_request() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(FileExplorerData::default())));
        let _ = storage.prepare_scan(vec![PathBuf::from("/tmp")]);

        let error = storage.finish_scan(99, Ok(vec![folder("/tmp", &["one.log"])]));

        assert!(error.is_none());
        assert_eq!(storage.active_scan_request_id, Some(1));
        assert!(matches!(
            storage.state,
            LoadState::Ready(FileExplorerData { favorite_folders }) if favorite_folders.is_empty()
        ));
    }

    #[test]
    fn finish_scan_replaces_matching_folder() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(FileExplorerData {
            favorite_folders: vec![folder("/tmp", &["old.log"]), folder("/other", &["x.log"])],
        })));
        let request = storage
            .prepare_scan(vec![PathBuf::from("/tmp")])
            .expect("scan request should be prepared");

        let error = storage.finish_scan(request.request_id, Ok(vec![folder("/tmp", &["new.log"])]));

        assert!(error.is_none());
        assert!(matches!(
            storage.state,
            LoadState::Ready(FileExplorerData { favorite_folders })
                if favorite_folders.len() == 2
                    && favorite_folders[0].path.as_path() == Path::new("/other")
                    && favorite_folders[1].path.as_path() == Path::new("/tmp")
                    && favorite_folders[1].files[0].name == "new.log"
        ));
        assert!(storage.active_scan_request_id.is_none());
    }

    #[test]
    fn add_scan_marks_storage_dirty_on_success() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(FileExplorerData::default())));

        let request = storage
            .prepare_add_scan(vec![PathBuf::from("/tmp")])
            .expect("add scan request should be prepared");

        let error = storage.finish_scan(request.request_id, Ok(vec![folder("/tmp", &["new.log"])]));

        assert!(error.is_none());
        assert!(storage.dirty);
    }

    #[test]
    fn refresh_scan_stays_clean() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(FileExplorerData {
            favorite_folders: vec![folder("/tmp", &["old.log"])],
        })));

        let request = storage
            .prepare_scan(vec![PathBuf::from("/tmp")])
            .expect("refresh scan request should be prepared");

        let error = storage.finish_scan(request.request_id, Ok(vec![folder("/tmp", &["new.log"])]));

        assert!(error.is_none());
        assert!(!storage.dirty);
        assert!(matches!(
            storage.state,
            LoadState::Ready(FileExplorerData { favorite_folders })
                if favorite_folders.len() == 1 && favorite_folders[0].files[0].name == "new.log"
        ));
    }

    #[test]
    fn remove_folder_marks_storage_dirty() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(FileExplorerData {
            favorite_folders: vec![folder("/tmp", &["old.log"]), folder("/other", &["x.log"])],
        })));

        storage.remove_favorite_folder(Path::new("/tmp"));

        assert!(storage.dirty);
        assert!(matches!(
            storage.state,
            LoadState::Ready(FileExplorerData { favorite_folders })
                if favorite_folders.len() == 1
                    && favorite_folders[0].path.as_path() == Path::new("/other")
        ));
    }
}
