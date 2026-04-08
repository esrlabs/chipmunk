//! Recent-sessions storage I/O.

use std::path::{Path, PathBuf};

use log::{trace, warn};
use tokio::sync::mpsc;

use super::storage_path;
use crate::host::ui::storage::{RecentSessionsData, StorageError, StorageErrorKind, StorageEvent};

const RECENT_SESSIONS_FILE: &str = "recent_sessions.json";

/// Starts the background load for recent-sessions storage and publishes the result.
pub fn spawn_load(event_tx: mpsc::Sender<StorageEvent>) {
    tokio::task::spawn_blocking(move || {
        let data = get_path().and_then(|path| load(&path));
        _ = event_tx.blocking_send(StorageEvent::RecentSessionsLoaded(data));
    });
}

fn load(path: &Path) -> Result<Box<RecentSessionsData>, StorageError> {
    let data = match std::fs::read_to_string(path) {
        Ok(data) => data,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            trace!(
                "Recent-sessions storage file does not exist: {}",
                path.display()
            );
            return Ok(Box::<RecentSessionsData>::default());
        }
        Err(err) => {
            warn!(
                "Failed to read recent-sessions storage from {}: {err}",
                path.display()
            );
            return Err(StorageError {
                kind: StorageErrorKind::Read,
                message: format!("Failed to read '{}': {err}", path.display()),
            });
        }
    };

    serde_json::from_str::<RecentSessionsData>(&data)
        .map(Box::new)
        .map_err(|err| {
            warn!(
                "Failed to parse recent-sessions storage from {}: {err}",
                path.display()
            );
            StorageError {
                kind: StorageErrorKind::Parse,
                message: format!("Failed to parse '{}': {err}", path.display()),
            }
        })
}

/// Persists the current recent-sessions snapshot to its storage file.
pub fn save(data: &RecentSessionsData) -> Result<(), StorageError> {
    let path = get_path()?;
    save_to_path(&path, data)
}

fn save_to_path(path: &Path, data: &RecentSessionsData) -> Result<(), StorageError> {
    let payload = serde_json::to_string_pretty(data).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to serialize '{}': {err}", path.display()),
    })?;

    std::fs::write(path, payload).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to write '{}': {err}", path.display()),
    })
}

fn get_path() -> Result<PathBuf, StorageError> {
    storage_path().map(|storage_dir| storage_dir.join(RECENT_SESSIONS_FILE))
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::save_to_path;
    use crate::host::service::storage::{STORAGE_DIR, storage_path_from_home};
    use crate::host::ui::storage::{StorageError, StorageErrorKind};

    use super::{RECENT_SESSIONS_FILE, RecentSessionsData, load};

    fn test_home_dir() -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time must be after unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("chipmunk-storage-test-{unique}"));
        fs::create_dir_all(&path).expect("temp test home dir should be created");
        path
    }

    fn path_from_home(home_dir: &std::path::Path) -> Result<std::path::PathBuf, StorageError> {
        let storage_dir = storage_path_from_home(home_dir)?;
        Ok(storage_dir.join(RECENT_SESSIONS_FILE))
    }

    fn save_to_home(
        home_dir: &std::path::Path,
        data: &RecentSessionsData,
    ) -> Result<(), StorageError> {
        let path = path_from_home(home_dir)?;
        save_to_path(&path, data)
    }

    #[test]
    fn missing_file_defaults() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");

        let data = load(&path).expect("missing file should default");

        assert_eq!(data.launch_count, 0);
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
    fn save_round_trips() {
        let home_dir = test_home_dir();
        let data = RecentSessionsData { launch_count: 7 };

        save_to_home(&home_dir, &data).expect("save should succeed");
        let saved_path = home_dir.join(STORAGE_DIR).join(RECENT_SESSIONS_FILE);
        assert!(saved_path.exists());

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = load(&path).expect("load should succeed");

        assert_eq!(loaded.launch_count, 7);
        let _ = fs::remove_dir_all(home_dir);
    }
}
