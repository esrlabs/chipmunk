//! Storage domain state for recent sessions.

use serde::{Deserialize, Serialize};

use super::{LoadState, StorageError};

/// Storage state for the recent-sessions domain.
#[derive(Debug)]
pub struct RecentSessionsStorage {
    pub state: LoadState<RecentSessionsData>,
    /// True when the in-memory data still needs to be saved.
    pub dirty: bool,
}

/// Recent-sessions storage data.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct RecentSessionsData {
    /// Number of app launches seen by this storage file.
    pub launch_count: u64,
}

impl RecentSessionsStorage {
    /// Creates the domain in the initial loading state.
    pub fn new() -> Self {
        Self {
            state: LoadState::Loading,
            dirty: false,
        }
    }

    /// Returns the current snapshot only when the domain is ready and dirty.
    pub fn get_save_data(&self) -> Option<RecentSessionsData> {
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
        result: Result<Box<RecentSessionsData>, StorageError>,
    ) -> Option<StorageError> {
        let data = match result {
            Ok(data) => *data,
            Err(err) => {
                self.state = LoadState::Ready(RecentSessionsData::default());
                self.dirty = false;
                return Some(err);
            }
        };

        self.state = LoadState::Ready(data);
        self.dirty = false;

        None
    }

    /// Applies the placeholder launch-count mutation for step 1.
    pub fn increment_launch_count(&mut self) {
        let LoadState::Ready(data) = &mut self.state else {
            return;
        };

        data.launch_count += 1;
        self.dirty = true;
    }

    /// Marks the current ready snapshot as persisted.
    pub fn apply_save_success(&mut self) {
        self.dirty = false;
    }

    /// Keeps the snapshot dirty so a later save can retry it.
    pub fn apply_save_error(&mut self) {
        self.dirty = true;
    }
}

#[cfg(test)]
mod tests {
    use super::{LoadState, RecentSessionsData, RecentSessionsStorage, StorageError};
    use crate::host::ui::storage::StorageErrorKind;

    fn test_storage() -> RecentSessionsStorage {
        RecentSessionsStorage::new()
    }

    #[test]
    fn load_success_keeps_saved_state() {
        let mut storage = test_storage();

        let error = storage.finish_load(Ok(Box::new(RecentSessionsData { launch_count: 4 })));

        assert!(error.is_none());
        assert!(!storage.dirty);
        assert!(matches!(
            storage.state,
            LoadState::Ready(RecentSessionsData { launch_count: 4 })
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
        assert!(!storage.dirty);
        assert!(matches!(
            storage.state,
            LoadState::Ready(RecentSessionsData { launch_count: 0 })
        ));
    }

    #[test]
    fn save_data_requires_dirty_ready() {
        let mut storage = test_storage();

        assert!(storage.get_save_data().is_none());

        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));

        let snapshot = storage.get_save_data();

        assert!(snapshot.is_none());
        assert!(!storage.dirty);
    }

    #[test]
    fn increment_marks_dirty() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));

        storage.increment_launch_count();

        assert!(storage.dirty);
        assert!(matches!(
            storage.state,
            LoadState::Ready(RecentSessionsData { launch_count: 1 })
        ));
    }

    #[test]
    fn save_success_clears_dirty() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));

        storage.apply_save_success();
        assert!(!storage.dirty);
    }

    #[test]
    fn save_error_keeps_dirty() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));

        storage.apply_save_error();
        assert!(storage.dirty);
    }

    #[test]
    fn load_error_returns_error() {
        let mut storage = test_storage();
        let err = storage.finish_load(Err(StorageError {
            kind: StorageErrorKind::Parse,
            message: "bad json".into(),
        }));

        assert!(matches!(
            err,
            Some(StorageError {
                kind: StorageErrorKind::Parse,
                ..
            })
        ));
        assert!(!storage.dirty);
        assert!(matches!(
            storage.state,
            LoadState::Ready(RecentSessionsData { launch_count: 0 })
        ));
    }
}
