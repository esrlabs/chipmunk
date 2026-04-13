//! Storage domain state for recent sessions.

use std::{path::PathBuf, sync::Arc};

use log::{info, warn};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use processor::search::filter::SearchFilter;
use stypes::{FileFormat, ObserveOptions, ObserveOrigin, ParserType, Transport};

use crate::common::time::unix_timestamp_now;

mod source_key;

pub const MAX_RECENT_SESSIONS: usize = 100;

/// Storage state for the recent-sessions domain.
#[derive(Debug)]
pub struct RecentSessionsStorage {
    /// Current recent-session snapshot.
    pub data: RecentSessionsData,
    /// True when the in-memory data still needs to be saved.
    pub dirty: bool,
}

/// Storage data for recent sessions.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RecentSessionsData {
    /// Stored in descending `last_opened` order because the home screen renders this list as-is.
    pub sessions: Vec<RecentSessionSnapshot>,
}

/// One stored recent-session snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentSessionSnapshot {
    /// Stable logical identity for one ordered source snapshot.
    pub source_key: Arc<str>,
    /// Display title for the recent-session list.
    pub title: String,
    /// Unix timestamp used to keep the list newest-first.
    pub last_opened: u64,
    /// Ordered source snapshot used for reopen flows and identity.
    pub source: RecentSourceSnapshot,
    /// Stored parser configuration.
    pub parser: ParserType,
    /// Stored restorable session-state snapshot.
    pub state: RecentSessionStateSnapshot,
}

/// Static metadata used to register and update one live recent session.
#[derive(Debug, Clone)]
pub struct RecentSessionRegistration {
    /// Stable logical identity for one ordered source snapshot.
    pub source_key: Arc<str>,
    /// Display title for the recent-session list.
    pub title: String,
    /// Unix timestamp used to keep the list newest-first.
    pub last_opened: u64,
    /// Ordered source snapshot used for reopen flows and identity.
    pub source: RecentSourceSnapshot,
    /// Stored parser configuration.
    pub parser: ParserType,
}

/// Reopen intent for a recent-session snapshot.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecentSessionReopenMode {
    RestoreSession,
    RestoreParserConfiguration,
    OpenClean,
}

/// Ordered source collection for a recent-session snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentSourceSnapshot {
    pub sources: Vec<RecentSessionSource>,
}

/// One source item within a recent-session snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecentSessionSource {
    File { format: FileFormat, path: PathBuf },
    Stream { transport: Transport },
}

/// Stored semantic state for reopening a session.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecentSessionStateSnapshot {
    pub filters: Vec<SearchFilterSnapshot>,
    pub search_values: Vec<SearchFilterSnapshot>,
    pub bookmarks: Vec<u64>,
}

/// Stored semantic filter or search-value row.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchFilterSnapshot {
    pub filter: SearchFilter,
    pub enabled: bool,
}

impl RecentSessionsStorage {
    /// Creates the domain from already-loaded recent-session data.
    pub fn new(data: RecentSessionsData) -> Self {
        Self { data, dirty: false }
    }

    /// Returns the current snapshot only when the domain is dirty.
    pub fn get_save_data(&self) -> Option<RecentSessionsData> {
        self.dirty.then(|| self.data.clone())
    }

    /// Registers a freshly opened session at the top of the recent list.
    pub fn register_session(&mut self, snapshot: RecentSessionSnapshot) {
        // Existing session => move it to the top of the list.
        // Otherwise => insert it at the top to keep newest-first ordering.
        if let Some(index) = self
            .data
            .sessions
            .iter()
            .position(|session| session.source_key == snapshot.source_key)
        {
            self.data.sessions.remove(index);
        }

        self.data.sessions.insert(0, snapshot);

        // Newest-first ordering means the oldest entries are always at the tail.
        self.data.sessions.truncate(MAX_RECENT_SESSIONS);
        self.dirty = true;
    }

    /// Updates the stored state for an already-registered session.
    pub fn update_session_state(&mut self, source_key: &str, state: RecentSessionStateSnapshot) {
        let Some(existing) = self
            .data
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
        mut appended_source: RecentSourceSnapshot,
        title: String,
        state: RecentSessionStateSnapshot,
    ) -> Option<Arc<str>> {
        let Some(current_snapshot) = self
            .data
            .sessions
            .iter()
            .find(|session| session.source_key == source_key)
        else {
            info!("Skipping recent-session append rebind for removed source key: {source_key}");
            return None;
        };

        let mut source = current_snapshot.source.clone();
        source.sources.append(&mut appended_source.sources);

        let new_source_key = source.generate_source_key();

        let new_snapshot = RecentSessionSnapshot {
            source,
            source_key: Arc::clone(&new_source_key),
            title,
            last_opened: unix_timestamp_now(),
            parser: current_snapshot.parser.clone(),
            state,
        };

        self.register_session(new_snapshot);
        Some(new_source_key)
    }

    /// Removes a recent session entry by source key.
    pub fn remove_session(&mut self, source_key: &str) {
        let initial_len = self.data.sessions.len();
        self.data
            .sessions
            .retain(|session| session.source_key.as_ref() != source_key);
        self.dirty |= self.data.sessions.len() != initial_len;
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

impl RecentSessionRegistration {
    /// Creates static recent-session metadata from explicit runtime parts.
    pub fn new(
        title: String,
        last_opened: u64,
        source: RecentSourceSnapshot,
        parser: ParserType,
    ) -> Self {
        let source_key = source.generate_source_key();

        Self {
            source_key,
            title,
            last_opened,
            source,
            parser,
        }
    }

    /// Converts this registration into a stored snapshot by attaching canonical runtime state.
    pub fn into_snapshot(self, state: RecentSessionStateSnapshot) -> RecentSessionSnapshot {
        RecentSessionSnapshot {
            source_key: self.source_key,
            title: self.title,
            last_opened: self.last_opened,
            source: self.source,
            parser: self.parser,
            state,
        }
    }
}

impl RecentSessionSnapshot {
    /// Rebuilds the startup observe plan for restore-style reopen flows.
    pub fn to_startup_restore_plan(&self) -> Option<(ObserveOptions, Vec<ObserveOrigin>)> {
        // Source types can't be mixed in one session.
        let first = self.source.sources.first()?;

        let (origin, additional_sources) = match first {
            RecentSessionSource::File { .. } => {
                let mut files = Vec::with_capacity(self.source.sources.len());
                for source in &self.source.sources {
                    let RecentSessionSource::File { format, path } = source else {
                        warn!(
                            "Recent source snapshot contains mixed source types and cannot be restored"
                        );
                        return None;
                    };
                    files.push((Uuid::new_v4().to_string(), *format, path.clone()));
                }

                let origin = if files.len() == 1 {
                    let (id, format, path) = files.pop()?;
                    ObserveOrigin::File(id, format, path)
                } else {
                    ObserveOrigin::Concat(files)
                };

                (origin, Vec::new())
            }
            RecentSessionSource::Stream { .. } => {
                let mut origins = Vec::with_capacity(self.source.sources.len());
                for source in &self.source.sources {
                    let RecentSessionSource::Stream { transport } = source else {
                        warn!(
                            "Recent source snapshot contains mixed source types and cannot be restored"
                        );
                        return None;
                    };
                    origins.push(ObserveOrigin::Stream(
                        Uuid::new_v4().to_string(),
                        transport.clone(),
                    ));
                }

                let mut origins = origins.into_iter();
                let initial = origins.next()?;
                (initial, origins.collect())
            }
        };

        let options = ObserveOptions {
            origin,
            parser: self.parser.clone(),
        };

        Some((options, additional_sources))
    }

    /// Returns whether the snapshot can be reopened through the normal open/setup flow.
    pub fn supports_clean_open(&self) -> bool {
        self.source.supports_clean_open()
    }
}

impl RecentSourceSnapshot {
    pub fn from_observe_origin(origin: ObserveOrigin) -> Self {
        let sources = match origin {
            ObserveOrigin::File(_, format, path) => {
                vec![RecentSessionSource::File { format, path }]
            }
            ObserveOrigin::Concat(files) => files
                .into_iter()
                .map(|(_, format, path)| RecentSessionSource::File { format, path })
                .collect(),
            ObserveOrigin::Stream(_, transport) => {
                vec![RecentSessionSource::Stream { transport }]
            }
        };

        Self { sources }
    }

    /// Returns the compact hashed key for this ordered source collection.
    pub fn generate_source_key(&self) -> Arc<str> {
        source_key::from_snapshot(self)
    }

    /// Returns whether the source snapshot supports clean open through the setup flow.
    pub fn supports_clean_open(&self) -> bool {
        match self.sources.first() {
            Some(RecentSessionSource::File { .. }) => true,
            Some(RecentSessionSource::Stream { .. }) => self.sources.len() == 1,
            None => false,
        }
    }

    /// Returns whether this source shape supports bookmark persistence.
    pub fn supports_bookmarks(&self) -> bool {
        matches!(self.sources.first(), Some(RecentSessionSource::File { .. }))
    }

    /// Returns a short source summary for the recent-session prototype UI.
    pub fn summary(&self) -> String {
        match self.sources.first() {
            Some(RecentSessionSource::File { path, .. }) if self.sources.len() == 1 => {
                path.display().to_string()
            }
            Some(RecentSessionSource::File { .. }) => format!("{} files", self.sources.len()),
            Some(RecentSessionSource::Stream { transport }) if self.sources.len() == 1 => {
                match transport {
                    Transport::Process(config) => config.command.clone(),
                    Transport::TCP(config) => config.bind_addr.clone(),
                    Transport::UDP(config) => config.bind_addr.clone(),
                    Transport::Serial(config) => config.path.clone(),
                }
            }
            Some(RecentSessionSource::Stream { transport }) => match transport {
                Transport::Process(_) => format!("{} terminal commands", self.sources.len()),
                Transport::TCP(_) => format!("{} TCP connections", self.sources.len()),
                Transport::UDP(_) => format!("{} UDP connections", self.sources.len()),
                Transport::Serial(_) => format!("{} serial connections", self.sources.len()),
            },
            None => String::from("No sources"),
        }
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

    use stypes::{
        ObserveOptions, ObserveOrigin, ParserType, TCPTransportConfig, Transport,
        UDPTransportConfig,
    };

    use crate::common::time::unix_timestamp_now;

    use super::{
        MAX_RECENT_SESSIONS, RecentSessionRegistration, RecentSessionSnapshot,
        RecentSessionStateSnapshot, RecentSessionsData, RecentSessionsStorage,
    };
    use crate::host::ui::storage::RecentSessionSource;

    fn test_storage() -> RecentSessionsStorage {
        RecentSessionsStorage::new(RecentSessionsData::default())
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

    fn snapshot_from_observe_options(
        title: String,
        options: ObserveOptions,
    ) -> RecentSessionSnapshot {
        RecentSessionRegistration::new(
            title,
            unix_timestamp_now(),
            super::RecentSourceSnapshot::from_observe_origin(options.origin),
            options.parser,
        )
        .into_snapshot(Default::default())
    }

    fn file_snapshot(path: PathBuf) -> RecentSessionSnapshot {
        snapshot_from_observe_options(
            path.file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("file")
                .to_owned(),
            ObserveOptions::file(path, stypes::FileFormat::Text, ParserType::Text(())),
        )
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
        snapshot_from_observe_options(
            bind_addr.to_owned(),
            ObserveOptions {
                origin: ObserveOrigin::Stream(
                    String::new(),
                    Transport::TCP(TCPTransportConfig {
                        bind_addr: bind_addr.to_owned(),
                    }),
                ),
                parser: ParserType::Text(()),
            },
        )
    }

    #[test]
    fn new_keeps_loaded_data() {
        let valid_path = write_test_file("valid.log");
        let valid_snapshot = file_snapshot(valid_path.clone());
        let invalid_snapshot = file_snapshot(valid_path.with_file_name("missing.log"));
        let storage = RecentSessionsStorage::new(RecentSessionsData {
            sessions: vec![valid_snapshot.clone(), invalid_snapshot.clone()],
        });

        assert!(!storage.dirty);
        assert_eq!(storage.data.sessions.len(), 2);
        assert_eq!(
            storage.data.sessions[0].source_key,
            valid_snapshot.source_key
        );
        assert_eq!(
            storage.data.sessions[1].source_key,
            invalid_snapshot.source_key
        );
    }

    #[test]
    fn save_data_requires_dirty_storage() {
        let storage = test_storage();

        assert!(storage.get_save_data().is_none());
        assert!(!storage.dirty);
    }

    #[test]
    fn register_overwrites_source() {
        let mut storage = test_storage();

        let path = std::env::temp_dir().join("chipmunk-recent-storage-overwrite.log");
        let original = snapshot_from_observe_options(
            "first title".into(),
            ObserveOptions::file(path.clone(), stypes::FileFormat::Text, ParserType::Text(())),
        );
        let mut replaced = snapshot_from_observe_options(
            "second title".into(),
            ObserveOptions::file(
                path,
                stypes::FileFormat::Text,
                ParserType::SomeIp(stypes::SomeIpParserSettings {
                    fibex_file_paths: None,
                }),
            ),
        );
        let mut stream = stream_snapshot("127.0.0.1:5555");
        stream.last_opened = 2;
        let mut original = original;
        original.last_opened = 1;
        replaced.last_opened = 3;

        storage.register_session(original.clone());
        storage.register_session(stream);
        storage.register_session(replaced.clone());

        assert_eq!(storage.data.sessions.len(), 2);
        assert_eq!(storage.data.sessions[0].source_key, original.source_key);
        assert_eq!(storage.data.sessions[0].title, "second title");
        assert!(matches!(
            storage.data.sessions[0].parser,
            ParserType::SomeIp(..)
        ));
    }

    #[test]
    fn update_state_preserves_position() {
        let mut storage = test_storage();
        let newest = named_snapshot_at("newest", 3);
        let middle = named_snapshot_at("middle", 2);
        let oldest = named_snapshot_at("oldest", 1);
        let oldest_title = oldest.title.clone();
        let middle_title = middle.title.clone();
        let middle_source_key = middle.source_key.clone();

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

        assert_eq!(storage.data.sessions.len(), 3);
        assert_eq!(storage.data.sessions[0].title, newest.title);
        assert_eq!(storage.data.sessions[1].title, middle_title);
        assert_eq!(storage.data.sessions[1].state.bookmarks, vec![7]);
        assert_eq!(storage.data.sessions[2].title, oldest_title);
    }

    #[test]
    fn register_trims_tail() {
        let mut storage = test_storage();

        for idx in 0..=MAX_RECENT_SESSIONS {
            storage.register_session(named_snapshot_at(&format!("session-{idx}"), idx as u64));
        }

        assert_eq!(storage.data.sessions.len(), MAX_RECENT_SESSIONS);
        assert!(
            storage.data.sessions[0]
                .title
                .ends_with(&format!("session-{MAX_RECENT_SESSIONS}.log"))
        );
        assert!(
            storage.data.sessions[MAX_RECENT_SESSIONS - 1]
                .title
                .ends_with("session-1.log")
        );
    }

    #[test]
    fn rebind_after_append_registers_new_snapshot() {
        let mut storage = test_storage();
        let first = write_test_file("rebind-first.log");
        let second = write_test_file("rebind-second.log");
        let original = file_snapshot(first);
        let original_key = original.source_key.clone();
        storage.register_session(original);
        storage.apply_save_success();

        let state = RecentSessionStateSnapshot {
            bookmarks: vec![7],
            ..Default::default()
        };
        let new_key = storage
            .rebind_after_append(
                original_key.clone(),
                super::RecentSourceSnapshot {
                    sources: vec![RecentSessionSource::File {
                        format: stypes::FileFormat::Text,
                        path: second,
                    }],
                },
                String::from("Concating 2 files"),
                state.clone(),
            )
            .expect("append rebind should create a new snapshot");

        assert_ne!(new_key, original_key);
        assert_eq!(storage.data.sessions.len(), 2);
        assert_eq!(storage.data.sessions[0].source_key, new_key);
        assert_eq!(storage.data.sessions[0].title, "Concating 2 files");
        assert_eq!(storage.data.sessions[0].source.sources.len(), 2);
        assert_eq!(storage.data.sessions[0].state, state);
        assert_eq!(storage.data.sessions[1].source_key, original_key);
        assert_eq!(storage.data.sessions[1].source.sources.len(), 1);
        assert!(storage.dirty);
    }

    #[test]
    fn rebind_after_append_returns_none_for_missing_snapshot() {
        let mut storage = test_storage();

        let result = storage.rebind_after_append(
            Arc::<str>::from("missing"),
            super::RecentSourceSnapshot {
                sources: vec![RecentSessionSource::File {
                    format: stypes::FileFormat::Text,
                    path: PathBuf::from("ignored.log"),
                }],
            },
            String::from("ignored"),
            Default::default(),
        );

        assert!(result.is_none());
        assert!(storage.data.sessions.is_empty());
        assert!(!storage.dirty);
    }

    #[test]
    fn remove_session_drops_snapshot() {
        let mut storage = test_storage();
        let snapshot = named_snapshot("single");
        let source_key = snapshot.source_key.clone();
        storage.register_session(snapshot);
        storage.apply_save_success();

        storage.remove_session(&source_key);

        assert!(storage.dirty);
        assert!(storage.data.sessions.is_empty());
    }

    #[test]
    fn save_success_clears_dirty() {
        let path = write_test_file("persisted.log");
        let mut storage = test_storage();
        storage.register_session(file_snapshot(path));

        storage.apply_save_success();

        assert!(!storage.dirty);
    }

    #[test]
    fn save_error_keeps_dirty() {
        let mut storage = test_storage();

        storage.apply_save_error();

        assert!(storage.dirty);
    }

    #[test]
    fn restore_rebuilds_runtime_ids() {
        let snapshot = snapshot_from_observe_options(
            "concat".into(),
            ObserveOptions {
                origin: ObserveOrigin::Concat(vec![
                    (
                        String::from("first-id"),
                        stypes::FileFormat::Text,
                        PathBuf::from("first.log"),
                    ),
                    (
                        String::from("second-id"),
                        stypes::FileFormat::Text,
                        PathBuf::from("second.log"),
                    ),
                ]),
                parser: ParserType::Text(()),
            },
        );

        let (restored, additional_sources) = snapshot
            .to_startup_restore_plan()
            .expect("startup restore plan should be rebuilt");

        assert!(additional_sources.is_empty());
        let ObserveOrigin::Concat(items) = restored.origin else {
            panic!("concat origin should be restored");
        };
        assert_eq!(items.len(), 2);
        assert_ne!(items[0].0, "first-id");
        assert_ne!(items[1].0, "second-id");
    }

    #[test]
    fn clean_open_support_matches_source_shape() {
        let files = snapshot_from_observe_options(
            "files".into(),
            ObserveOptions {
                origin: ObserveOrigin::Concat(vec![
                    (
                        String::new(),
                        stypes::FileFormat::Text,
                        PathBuf::from("first.log"),
                    ),
                    (
                        String::new(),
                        stypes::FileFormat::Text,
                        PathBuf::from("second.log"),
                    ),
                ]),
                parser: ParserType::Text(()),
            },
        );
        let stream = stream_snapshot("127.0.0.1:5556");
        let invalid_multi_stream = RecentSessionSnapshot {
            source_key: Arc::<str>::from("multi-stream"),
            title: String::from("multi-stream"),
            last_opened: 1,
            source: super::RecentSourceSnapshot {
                sources: vec![
                    RecentSessionSource::Stream {
                        transport: Transport::TCP(TCPTransportConfig {
                            bind_addr: String::from("127.0.0.1:5000"),
                        }),
                    },
                    RecentSessionSource::Stream {
                        transport: Transport::UDP(UDPTransportConfig {
                            bind_addr: String::from("127.0.0.1:5001"),
                            multicast: Vec::new(),
                        }),
                    },
                ],
            },
            parser: ParserType::Text(()),
            state: Default::default(),
        };

        assert!(files.supports_clean_open());
        assert!(stream.supports_clean_open());
        assert!(!invalid_multi_stream.supports_clean_open());
    }
}
