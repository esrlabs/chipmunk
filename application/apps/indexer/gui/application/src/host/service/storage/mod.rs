//! Host-side storage worker.
//!
//! This module owns background storage tasks and the shared storage root path,
//! while domain-specific persistence lives in submodules such as `recent`.

use std::{
    path::{Path, PathBuf},
    sync::mpsc::Sender as StdSender,
};

use log::warn;
use tokio::sync::mpsc;

use crate::host::ui::storage::{StorageError, StorageErrorKind, StorageEvent, StorageSaveData};

mod file_explorer;
mod recent;

const CHANNEL_CAPACITY: usize = 16;
const STORAGE_DIR: &str = "storage_2";

#[derive(Debug)]
pub struct StorageService {
    event_tx: mpsc::Sender<StorageEvent>,
    /// Worker events consumed by the host service loop.
    pub event_rx: mpsc::Receiver<StorageEvent>,
}

impl StorageService {
    /// Creates the storage worker and starts its background domain loads.
    pub fn spawn() -> Self {
        let (event_tx, event_rx) = mpsc::channel(CHANNEL_CAPACITY);
        let service = Self { event_tx, event_rx };

        file_explorer::spawn_load(service.event_tx.clone());
        recent::spawn_load(service.event_tx.clone());

        service
    }

    /// Persists the provided storage snapshot without blocking the host loop.
    pub fn save_storage(
        &self,
        data: Box<StorageSaveData>,
        confirm_tx: StdSender<Result<(), StorageError>>,
    ) {
        tokio::task::spawn_blocking(move || {
            let result = save_storage(&data);
            if let Err(err) = confirm_tx.send(result) {
                warn!("Failed to send storage save confirmation: {err:?}");
            }
        });
    }

    /// Scans the provided favorite folders without blocking the host loop.
    pub fn scan_favorite_folders(&self, request_id: u64, paths: Vec<PathBuf>) {
        let event_tx = self.event_tx.clone();

        tokio::task::spawn_blocking(move || {
            let result = file_explorer::scan_favorite_folders(&paths);

            let event = StorageEvent::FavoriteFoldersScanned {
                request_id,
                result: Ok(result),
            };

            if event_tx.blocking_send(event).is_err() {
                warn!("Failed to send favorite-folder scan result");
            }
        });
    }
}

/// Saves all storage domains present in the aggregate payload.
fn save_storage(data: &StorageSaveData) -> Result<(), StorageError> {
    if let Some(file_explorer) = &data.file_explorer {
        file_explorer::save(file_explorer)?;
    }

    if let Some(recent_sessions) = &data.recent_sessions {
        recent::save(recent_sessions)?;
    }

    Ok(())
}

/// Resolves the shared storage root under the Chipmunk home directory.
fn storage_path() -> Result<PathBuf, StorageError> {
    let home_dir = session_core::paths::get_home_dir().map_err(|err| StorageError {
        kind: StorageErrorKind::Path,
        message: err
            .message
            .unwrap_or_else(|| "Failed to resolve Chipmunk home directory.".into()),
    })?;

    storage_path_from_home(&home_dir)
}

/// Ensures the shared storage root exists for the provided home directory.
fn storage_path_from_home(home_dir: &Path) -> Result<PathBuf, StorageError> {
    let storage_dir = home_dir.join(STORAGE_DIR);

    std::fs::create_dir_all(&storage_dir).map_err(|err| StorageError {
        kind: StorageErrorKind::Path,
        message: format!("Failed to create '{}': {err}", storage_dir.display()),
    })?;

    Ok(storage_dir)
}
