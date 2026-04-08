//! File-explorer storage I/O.

use std::{
    fs::File,
    io::{BufReader, BufWriter},
    path::{Path, PathBuf},
};

use log::{trace, warn};
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

use super::storage_path;
use crate::host::{
    common::file_utls,
    ui::storage::{
        FavoriteFolder, FileExplorerData, FileUiInfo, StorageError, StorageErrorKind, StorageEvent,
    },
};

const FILE_EXPLORER_FILE: &str = "file_explorer.json";

/// Path-only file-explorer schema stored on disk.
#[derive(Debug, Default, Serialize, Deserialize)]
struct PersistedFileExplorerData {
    favorite_folders: Vec<PathBuf>,
}

impl From<&FileExplorerData> for PersistedFileExplorerData {
    fn from(data: &FileExplorerData) -> Self {
        Self {
            favorite_folders: data
                .favorite_folders
                .iter()
                .map(|folder| folder.path.clone())
                .collect(),
        }
    }
}

/// Starts the background load for file-explorer storage and publishes the result.
pub fn spawn_load(event_tx: mpsc::Sender<StorageEvent>) {
    tokio::task::spawn_blocking(move || {
        let result = get_path().and_then(|path| load(&path));

        match result {
            Ok(data) => {
                let data = FileExplorerData {
                    favorite_folders: scan_favorite_folders(&data.favorite_folders),
                };
                _ = event_tx.blocking_send(StorageEvent::FileExplorerLoaded(Ok(Box::new(data))));
            }
            Err(err) => {
                _ = event_tx.blocking_send(StorageEvent::FileExplorerLoaded(Err(err)));
            }
        }
    });
}

/// Loads the persisted favorite-folder paths from disk.
fn load(path: &Path) -> Result<PersistedFileExplorerData, StorageError> {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            trace!(
                "File-explorer storage file does not exist: {}",
                path.display()
            );
            return Ok(PersistedFileExplorerData::default());
        }
        Err(err) => {
            warn!(
                "Failed to read file-explorer storage from {}: {err}",
                path.display()
            );
            return Err(StorageError {
                kind: StorageErrorKind::Read,
                message: format!("Failed to read '{}': {err}", path.display()),
            });
        }
    };

    let reader = BufReader::new(file);
    serde_json::from_reader::<_, PersistedFileExplorerData>(reader).map_err(|err| {
        warn!(
            "Failed to parse file-explorer storage from {}: {err}",
            path.display()
        );

        StorageError {
            kind: StorageErrorKind::Parse,
            message: format!("Failed to parse '{}': {err}", path.display()),
        }
    })
}

/// Scans the provided favorite folders and returns runtime file snapshots.
pub fn scan_favorite_folders(paths: &[PathBuf]) -> Vec<FavoriteFolder> {
    paths.iter().map(|p| scan_folder(p)).collect()
}

/// Persists the file-explorer domain to its storage file.
pub fn save(data: &FileExplorerData) -> Result<(), StorageError> {
    let path = get_path()?;
    let persist_data = PersistedFileExplorerData::from(data);
    save_to_path(&path, &persist_data)
}

/// Writes the file-explorer snapshot to the provided path.
fn save_to_path(path: &Path, data: &PersistedFileExplorerData) -> Result<(), StorageError> {
    let file = File::create(path).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to write '{}': {err}", path.display()),
    })?;

    serde_json::to_writer_pretty(BufWriter::new(file), data).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to serialize '{}': {err}", path.display()),
    })
}

/// Resolves the file-explorer storage file path under the shared storage directory.
fn get_path() -> Result<PathBuf, StorageError> {
    storage_path().map(|storage_dir| storage_dir.join(FILE_EXPLORER_FILE))
}

/// Scans one favorite folder without recursing into subdirectories.
fn scan_folder(path: &Path) -> FavoriteFolder {
    let mut folder = FavoriteFolder::new(path.to_owned());

    let entries = match std::fs::read_dir(&path) {
        Ok(entries) => entries,
        Err(err) => {
            warn!("Failed to scan favorite folder {}: {err}", path.display());

            return folder;
        }
    };

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(err) => {
                warn!(
                    "Failed to read an entry in favorite folder {}: {err}",
                    path.display()
                );
                continue;
            }
        };

        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(err) => {
                warn!(
                    "Failed to read metadata for {} while scanning favorite folder {}: {err}",
                    entry.path().display(),
                    path.display()
                );
                continue;
            }
        };

        if metadata.file_type().is_symlink() || !metadata.is_file() {
            continue;
        }

        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.starts_with('.') {
            continue;
        }

        folder.files.push(FileUiInfo::new(
            file_name,
            file_utls::format_file_size(metadata.len()),
        ));
    }

    folder
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        os::unix::fs::symlink,
        path::{Path, PathBuf},
        time::{SystemTime, UNIX_EPOCH},
    };

    use crate::host::service::storage::storage_path_from_home;
    use crate::host::ui::storage::{
        FavoriteFolder, FileExplorerData, StorageError, StorageErrorKind,
    };

    use super::{
        FILE_EXPLORER_FILE, PersistedFileExplorerData, load, save_to_path, scan_favorite_folders,
    };

    fn test_home_dir() -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time must be after unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("chipmunk-file-explorer-test-{unique}"));
        fs::create_dir_all(&path).expect("temp test home dir should be created");
        path
    }

    fn path_from_home(home_dir: &Path) -> Result<PathBuf, StorageError> {
        let storage_dir = storage_path_from_home(home_dir)?;
        Ok(storage_dir.join(FILE_EXPLORER_FILE))
    }

    fn persisted_data(paths: &[PathBuf]) -> PersistedFileExplorerData {
        PersistedFileExplorerData {
            favorite_folders: paths.to_vec(),
        }
    }

    #[test]
    fn missing_file_defaults() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");

        let data = load(&path).expect("missing file should default");

        assert!(data.favorite_folders.is_empty());
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn malformed_json_fails() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");
        fs::write(&path, "{not-json").expect("invalid json should be written");

        let err = load(&path).expect_err("invalid json should fail");

        assert_eq!(err.kind, StorageErrorKind::Parse);
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn save_skips_scanned_files() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");
        let mut runtime = FileExplorerData {
            favorite_folders: vec![FavoriteFolder::new(PathBuf::from("/tmp/favorites"))],
        };
        runtime.favorite_folders[0]
            .files
            .push(crate::host::ui::storage::FileUiInfo::new(
                "visible.log".into(),
                "1 B".into(),
            ));

        save_to_path(&path, &PersistedFileExplorerData::from(&runtime))
            .expect("save should succeed");
        let loaded = load(&path).expect("saved file should be readable");

        assert_eq!(
            loaded.favorite_folders,
            vec![PathBuf::from("/tmp/favorites")]
        );
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn load_reads_path_only_shape() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");

        save_to_path(
            &path,
            &persisted_data(&[PathBuf::from("/tmp/one"), PathBuf::from("/tmp/two")]),
        )
        .expect("save should succeed");

        let loaded = load(&path).expect("saved file should reload");

        assert_eq!(
            loaded.favorite_folders,
            vec![PathBuf::from("/tmp/one"), PathBuf::from("/tmp/two")]
        );
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn scan_filters_entries() {
        let dir = test_home_dir();
        let visible = dir.join("visible.log");
        let hidden = dir.join(".hidden.log");
        let nested_dir = dir.join("nested");
        let symlink_path = dir.join("linked.log");

        fs::write(&visible, "hello").expect("visible file should be written");
        fs::write(&hidden, "secret").expect("hidden file should be written");
        fs::create_dir(&nested_dir).expect("nested dir should be created");
        symlink(&visible, &symlink_path).expect("symlink should be created");

        let scanned = scan_favorite_folders(&[dir.clone()]);

        assert_eq!(scanned.len(), 1);
        assert_eq!(scanned[0].path, dir);
        assert_eq!(scanned[0].files.len(), 1);
        assert_eq!(scanned[0].files[0].name, "visible.log");

        let _ = fs::remove_dir_all(scanned[0].path.clone());
    }

    #[test]
    fn missing_folder_returns_empty_snapshot() {
        let missing = std::env::temp_dir().join("chipmunk-missing-favorite-folder");
        let scanned = scan_favorite_folders(&[missing.clone()]);

        assert_eq!(scanned.len(), 1);
        assert_eq!(scanned[0].path, missing);
        assert!(scanned[0].files.is_empty());
    }
}
