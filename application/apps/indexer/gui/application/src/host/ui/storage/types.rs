//! Shared storage-facing types for the host UI storage boundary.

use thiserror::Error;

use super::{FavoriteFolder, FileExplorerData, RecentSessionsData};

/// Represents the loading state of storage domain.
#[derive(Debug)]
pub enum LoadState<T> {
    /// The domain is still waiting for its async load result.
    Loading,
    /// The domain finished loading and has usable data.
    Ready(T),
}

/// Storage events sent to the host.
#[derive(Debug)]
pub enum StorageEvent {
    /// File-explorer startup load results.
    FileExplorerLoaded(Result<Box<FileExplorerData>, StorageError>),
    /// Favorite-folder scan results for a specific request.
    FavoriteFoldersScanned {
        request_id: u64,
        result: Result<Vec<FavoriteFolder>, StorageError>,
    },
}

/// Data sent from the UI to the storage service.
#[derive(Debug, Clone, Default)]
pub struct StorageSaveData {
    pub recent_sessions: Option<RecentSessionsData>,
    pub file_explorer: Option<FileExplorerData>,
}

/// Typed storage failure used across storage.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
#[error("{kind}: {message}")]
pub struct StorageError {
    /// Stable category for programmatic handling and reporting.
    pub kind: StorageErrorKind,
    /// Human-readable context for logs and notifications.
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageErrorKind {
    /// The storage root or target path could not be resolved or created.
    Path,
    /// Reading persisted data failed.
    Read,
    /// Persisted data could not be parsed.
    Parse,
    /// Serializing or writing persisted data failed.
    Write,
}

impl std::fmt::Display for StorageErrorKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let label = match self {
            Self::Path => "storage path error",
            Self::Read => "storage read error",
            Self::Parse => "storage parse error",
            Self::Write => "storage write error",
        };

        write!(f, "{label}")
    }
}
