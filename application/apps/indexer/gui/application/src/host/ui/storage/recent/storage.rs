//! In-memory recent-session storage state and persistence-facing mutations.
//!
//! This module owns the recent-session collection, dirty tracking, load logic,
//! and the mutations used by the host UI while sessions are opened and updated.

use std::{fs::File, io::BufReader, path::Path, sync::Arc};

use log::{info, trace, warn};
use serde::{Deserialize, Serialize};

use crate::{
    common::time::unix_timestamp_now,
    host::ui::storage::{StorageError, StorageErrorKind},
};

use super::super::SaveOutcome;
use super::{RecentSessionSnapshot, RecentSessionSource, RecentSessionStateSnapshot};

pub const MAX_RECENT_SESSIONS: usize = 100;

/// Storage state for the recent-sessions domain.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RecentSessionsStorage {
    /// Stored in descending `last_opened` order because the home screen renders this list as-is.
    pub sessions: Vec<RecentSessionSnapshot>,
    /// True when the in-memory data still needs to be saved.
    #[serde(skip, default)]
    dirty: bool,
}

impl RecentSessionsStorage {
    pub fn load(path: &Path) -> Result<Self, StorageError> {
        let file = match File::open(path) {
            Ok(file) => file,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
                trace!(
                    "Recent-sessions storage file does not exist: {}",
                    path.display()
                );
                return Ok(Self::default());
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

        let mut storage: Self = serde_json::from_reader(BufReader::new(file)).map_err(|err| {
            warn!(
                "Failed to parse recent-sessions storage from {}: {err}",
                path.display()
            );
            StorageError {
                kind: StorageErrorKind::Parse,
                message: format!("Failed to parse '{}': {err}", path.display()),
            }
        })?;

        storage.refresh_cached_fields();
        Ok(storage)
    }

    /// Returns the current snapshot only when the domain is dirty.
    pub fn get_save_data(&self) -> Option<Self> {
        self.dirty.then(|| self.clone())
    }

    /// Registers a freshly opened session at the top of the recent list.
    pub fn register_session(&mut self, snapshot: RecentSessionSnapshot) {
        // Existing session => move it to the top of the list.
        // Otherwise => insert it at the top to keep newest-first ordering.
        if let Some(index) = self
            .sessions
            .iter()
            .position(|session| session.source_key == snapshot.source_key)
        {
            self.sessions.remove(index);
        }

        self.sessions.insert(0, snapshot);

        // Newest-first ordering means the oldest entries are always at the tail.
        self.sessions.truncate(MAX_RECENT_SESSIONS);
        self.dirty = true;
    }

    /// Updates the stored state for an already-registered session.
    pub fn update_session_state(&mut self, source_key: &str, state: RecentSessionStateSnapshot) {
        let Some(existing) = self
            .sessions
            .iter_mut()
            .find(|session| session.source_key.as_ref() == source_key)
        else {
            warn!("Ignoring recent-session update for unknown source key: {source_key}");
            return;
        };

        existing.state = state;
        self.dirty = true;
    }

    /// Clones the current snapshot, appends new sources, and re-registers it under the new key.
    ///
    /// # Returns
    ///
    /// - `Some(new_source_key)` when the current recent snapshot exists.
    /// - `None` when the old recent entry was already removed.
    pub fn rebind_after_append(
        &mut self,
        source_key: Arc<str>,
        mut appended_sources: Vec<RecentSessionSource>,
        state: RecentSessionStateSnapshot,
    ) -> Option<Arc<str>> {
        let Some(current_snapshot) = self
            .sessions
            .iter()
            .find(|session| session.source_key == source_key)
        else {
            info!("Skipping recent-session append rebind for removed source key: {source_key}");
            return None;
        };

        let mut sources = current_snapshot.sources().to_vec();
        sources.append(&mut appended_sources);

        let new_snapshot = RecentSessionSnapshot::new(
            unix_timestamp_now(),
            sources,
            current_snapshot.parser.clone(),
            state,
        );
        let new_source_key = Arc::clone(&new_snapshot.source_key);

        self.register_session(new_snapshot);
        Some(new_source_key)
    }

    /// Removes a recent session entry by source key.
    pub fn remove_session(&mut self, source_key: &str) {
        let initial_len = self.sessions.len();
        self.sessions
            .retain(|session| session.source_key.as_ref() != source_key);
        self.dirty |= self.sessions.len() != initial_len;
    }

    pub(in crate::host::ui::storage) fn apply_save_outcome(&mut self, outcome: SaveOutcome) {
        self.dirty = match outcome {
            SaveOutcome::Succeeded => false,
            SaveOutcome::Failed => true,
        };
    }

    fn refresh_cached_fields(&mut self) {
        self.sessions
            .iter_mut()
            .for_each(RecentSessionSnapshot::update_title_and_summary);
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        sync::Arc,
        time::{SystemTime, UNIX_EPOCH},
    };

    use stypes::{ObserveOptions, ObserveOrigin, ParserType, TCPTransportConfig, Transport};

    use super::{
        MAX_RECENT_SESSIONS, RecentSessionSnapshot, RecentSessionSource, RecentSessionsStorage,
    };
    use crate::{
        common::time::unix_timestamp_now,
        host::ui::storage::{RecentSessionRegistration, RecentSessionStateSnapshot, SaveOutcome},
    };

    fn test_storage() -> RecentSessionsStorage {
        RecentSessionsStorage::default()
    }

    fn test_dir() -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time must be after unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("chipmunk-recent-storage-test-{unique}"));
        fs::create_dir_all(&path).expect("temp test dir should be created");
        path
    }

    fn write_test_file(name: &str) -> PathBuf {
        let dir = test_dir();
        let path = dir.join(name);
        fs::write(&path, "test").expect("test file should be written");
        path
    }

    fn snapshot_from_observe_options(options: ObserveOptions) -> RecentSessionSnapshot {
        RecentSessionRegistration::new(
            unix_timestamp_now(),
            RecentSessionSource::from_observe_origin(options.origin),
            options.parser,
        )
        .into_snapshot(Default::default())
    }

    fn file_snapshot(path: PathBuf) -> RecentSessionSnapshot {
        snapshot_from_observe_options(ObserveOptions::file(
            path,
            stypes::FileFormat::Text,
            ParserType::Text(()),
        ))
    }

    fn named_snapshot(name: &str) -> RecentSessionSnapshot {
        file_snapshot(std::env::temp_dir().join(format!("chipmunk-recent-storage-test-{name}.log")))
    }

    fn named_snapshot_at(name: &str, last_opened: u64) -> RecentSessionSnapshot {
        let mut snapshot = named_snapshot(name);
        snapshot.last_opened = last_opened;
        snapshot
    }

    fn stream_snapshot(bind_addr: &str) -> RecentSessionSnapshot {
        snapshot_from_observe_options(ObserveOptions {
            origin: ObserveOrigin::Stream(
                String::new(),
                Transport::TCP(TCPTransportConfig {
                    bind_addr: bind_addr.to_owned(),
                }),
            ),
            parser: ParserType::Text(()),
        })
    }

    #[test]
    fn load_refreshes_titles() {
        let path = test_dir().join("recent.json");
        let storage = RecentSessionsStorage {
            sessions: vec![file_snapshot(PathBuf::from("cached-title.log"))],
            dirty: false,
        };
        let json = serde_json::to_string(&storage).expect("storage should serialize");
        fs::write(&path, json).expect("storage fixture should be written");

        let loaded = RecentSessionsStorage::load(&path).expect("storage should load");

        assert_eq!(loaded.sessions[0].title(), "cached-title.log");
    }

    #[test]
    fn keeps_loaded_sessions() {
        let valid_path = write_test_file("valid.log");
        let valid_snapshot = file_snapshot(valid_path.clone());
        let invalid_snapshot = file_snapshot(valid_path.with_file_name("missing.log"));
        let storage = RecentSessionsStorage {
            sessions: vec![valid_snapshot.clone(), invalid_snapshot.clone()],
            dirty: false,
        };

        assert!(!storage.dirty);
        assert_eq!(storage.sessions.len(), 2);
        assert_eq!(storage.sessions[0].source_key, valid_snapshot.source_key);
        assert_eq!(storage.sessions[1].source_key, invalid_snapshot.source_key);
    }

    #[test]
    fn save_data_requires_dirty() {
        let storage = test_storage();

        assert!(storage.get_save_data().is_none());
        assert!(!storage.dirty);
    }

    #[test]
    fn register_overwrites_source() {
        let mut storage = test_storage();

        let path = std::env::temp_dir().join("chipmunk-recent-storage-overwrite.log");
        let original = snapshot_from_observe_options(ObserveOptions::file(
            path.clone(),
            stypes::FileFormat::Text,
            ParserType::Text(()),
        ));
        let mut replaced = snapshot_from_observe_options(ObserveOptions::file(
            path,
            stypes::FileFormat::Text,
            ParserType::SomeIp(stypes::SomeIpParserSettings {
                fibex_file_paths: None,
            }),
        ));
        let mut stream = stream_snapshot("127.0.0.1:5555");
        stream.last_opened = 2;
        let mut original = original;
        original.last_opened = 1;
        replaced.last_opened = 3;

        storage.register_session(original.clone());
        storage.register_session(stream);
        storage.register_session(replaced.clone());

        assert_eq!(storage.sessions.len(), 2);
        assert_eq!(storage.sessions[0].source_key, original.source_key);
        assert_eq!(
            storage.sessions[0].title(),
            "chipmunk-recent-storage-overwrite.log"
        );
        assert!(matches!(storage.sessions[0].parser, ParserType::SomeIp(..)));
    }

    #[test]
    fn update_keeps_position() {
        let mut storage = test_storage();
        let newest = named_snapshot_at("newest", 3);
        let newest_source_key = newest.source_key.clone();
        let middle = named_snapshot_at("middle", 2);
        let middle_source_key = middle.source_key.clone();
        let oldest = named_snapshot_at("oldest", 1);
        let oldest_source_key = oldest.source_key.clone();

        storage.register_session(oldest);
        storage.register_session(middle);
        storage.register_session(newest.clone());

        storage.update_session_state(
            &middle_source_key,
            RecentSessionStateSnapshot {
                bookmarks: vec![7],
                ..Default::default()
            },
        );

        assert_eq!(storage.sessions.len(), 3);
        assert_eq!(storage.sessions[0].source_key, newest_source_key);
        assert_eq!(storage.sessions[1].source_key, middle_source_key);
        assert_eq!(storage.sessions[1].state.bookmarks, vec![7]);
        assert_eq!(storage.sessions[2].source_key, oldest_source_key);
    }

    #[test]
    fn register_trims_tail() {
        let mut storage = test_storage();

        for idx in 0..=MAX_RECENT_SESSIONS {
            storage.register_session(named_snapshot_at(&format!("session-{idx}"), idx as u64));
        }

        assert_eq!(storage.sessions.len(), MAX_RECENT_SESSIONS);
        assert_eq!(
            storage.sessions[0].title(),
            format!("chipmunk-recent-storage-test-session-{MAX_RECENT_SESSIONS}.log")
        );
        assert_eq!(
            storage.sessions[MAX_RECENT_SESSIONS - 1].title(),
            "chipmunk-recent-storage-test-session-1.log"
        );
    }

    #[test]
    fn append_rebinds_snapshot() {
        let mut storage = test_storage();
        let first = write_test_file("rebind-first.log");
        let second = write_test_file("rebind-second.log");
        let original = file_snapshot(first);
        let original_key = original.source_key.clone();
        storage.register_session(original);
        storage.dirty = false;

        let state = RecentSessionStateSnapshot {
            bookmarks: vec![7],
            ..Default::default()
        };
        let new_key = storage
            .rebind_after_append(
                original_key.clone(),
                vec![RecentSessionSource::File {
                    format: stypes::FileFormat::Text,
                    path: second,
                }],
                state.clone(),
            )
            .expect("append rebind should create a new snapshot");

        assert_ne!(new_key, original_key);
        assert_eq!(storage.sessions.len(), 2);
        assert_eq!(storage.sessions[0].source_key, new_key);
        assert_eq!(
            storage.sessions[0].title(),
            "rebind-first.log & rebind-second.log"
        );
        assert_eq!(storage.sessions[0].sources().len(), 2);
        assert_eq!(storage.sessions[0].state, state);
        assert_eq!(storage.sessions[1].source_key, original_key);
        assert_eq!(storage.sessions[1].sources().len(), 1);
        assert!(storage.dirty);
    }

    #[test]
    fn append_missing_returns_none() {
        let mut storage = test_storage();

        let result = storage.rebind_after_append(
            Arc::<str>::from("missing"),
            vec![RecentSessionSource::File {
                format: stypes::FileFormat::Text,
                path: PathBuf::from("ignored.log"),
            }],
            Default::default(),
        );

        assert!(result.is_none());
        assert!(storage.sessions.is_empty());
        assert!(!storage.dirty);
    }

    #[test]
    fn remove_drops_snapshot() {
        let mut storage = test_storage();
        let snapshot = named_snapshot("single");
        let source_key = snapshot.source_key.clone();
        storage.register_session(snapshot);
        storage.dirty = false;

        storage.remove_session(&source_key);

        assert!(storage.dirty);
        assert!(storage.sessions.is_empty());
    }

    #[test]
    fn save_outcome_updates_dirty() {
        let mut storage = test_storage();
        storage.register_session(named_snapshot("dirty"));

        storage.apply_save_outcome(SaveOutcome::Succeeded);
        assert!(!storage.dirty);

        storage.apply_save_outcome(SaveOutcome::Failed);
        assert!(storage.dirty);
    }
}
