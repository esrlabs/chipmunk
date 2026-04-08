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

        recent::spawn_load(service.event_tx.clone());

        service
    }

    /// Persists the provided storage snapshot without blocking the host loop.
    pub fn save_storage(
        &self,
        data: Box<StorageSaveData>,
        confirm_tx: StdSender<Result<(), StorageError>>,
    ) {
        tokio::spawn(async move {
            let result = tokio::task::spawn_blocking(move || save_storage(&data))
                .await
                .map_err(|err| StorageError {
                    kind: StorageErrorKind::Write,
                    message: format!("Storage save task failed: {err}"),
                })
                .and_then(|result| result);

            if let Err(err) = confirm_tx.send(result) {
                warn!("Failed to send storage save confirmation: {err:?}");
            }
        });
    }
}

/// Saves all storage domains present in the aggregate payload.
fn save_storage(data: &StorageSaveData) -> Result<(), StorageError> {
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
