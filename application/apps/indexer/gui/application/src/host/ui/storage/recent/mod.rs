//! Storage domain state for recent sessions.

use std::{
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use log::warn;
use serde::{Deserialize, Serialize};
use stypes::{FileFormat, ObserveOptions, ObserveOrigin, ParserType, Transport};
use uuid::Uuid;

use super::{LoadState, StorageError};

mod source_key;

pub const MAX_RECENT_SESSIONS: usize = 100;

/// Storage state for the recent-sessions domain.
#[derive(Debug)]
pub struct RecentSessionsStorage {
    pub state: LoadState<RecentSessionsData>,
    // `register_session` can run before the async load finishes during startup.
    pending_registrations: Vec<RecentSessionSnapshot>,
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
    pub source_key: String,
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

/// Step-1 placeholder for future restorable session state.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RecentSessionStateSnapshot {}

impl RecentSessionsStorage {
    /// Creates the domain in the initial loading state.
    pub fn new() -> Self {
        Self {
            state: LoadState::Loading,
            pending_registrations: Vec::new(),
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
        let (mut data, err) = match result {
            Ok(data) => (*data, None),
            Err(err) => (RecentSessionsData::default(), Some(err)),
        };

        let mut dirty = false;

        for registration in self.pending_registrations.drain(..) {
            register_loaded_session(&mut data.sessions, registration);
            dirty = true;
        }

        self.state = LoadState::Ready(data);
        self.dirty = dirty;

        err
    }

    /// Registers an opened session and keeps the list newest-first.
    pub fn register_session(&mut self, snapshot: RecentSessionSnapshot) {
        match &mut self.state {
            LoadState::Ready(data) => {
                register_loaded_session(&mut data.sessions, snapshot);
                self.dirty = true;
            }
            LoadState::Loading => {
                // Startup opens can happen before the async load completes. Buffer them so the
                // loaded snapshot can replay the same newest-first mutations once it arrives.
                self.pending_registrations.push(snapshot);
            }
        }
    }

    /// Removes a recent session entry by source key.
    pub fn remove_session(&mut self, source_key: &str) {
        let LoadState::Ready(data) = &mut self.state else {
            return;
        };

        let initial_len = data.sessions.len();
        data.sessions
            .retain(|session| session.source_key != source_key);
        self.dirty |= data.sessions.len() != initial_len;
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

impl RecentSessionSnapshot {
    /// Builds a stored recent-session snapshot from observe options.
    pub fn from_observe_options(title: String, options: ObserveOptions) -> Self {
        let source = RecentSourceSnapshot::from_observe_origin(options.origin);
        let source_key = source.source_key();

        Self {
            source_key,
            title,
            last_opened: unix_timestamp_now(),
            source,
            parser: options.parser,
            state: RecentSessionStateSnapshot::default(),
        }
    }

    /// Rebuilds observe options for restore-style reopen flows.
    pub fn to_observe_options(&self) -> Option<ObserveOptions> {
        Some(ObserveOptions {
            origin: self.source.to_observe_origin()?,
            parser: self.parser.clone(),
        })
    }

    /// Returns whether the snapshot can be reopened through the normal open/setup flow.
    pub fn supports_clean_open(&self) -> bool {
        self.source.supports_clean_open()
    }
}

impl RecentSourceSnapshot {
    fn from_observe_origin(origin: ObserveOrigin) -> Self {
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
    pub fn source_key(&self) -> String {
        source_key::from_snapshot(self)
    }

    /// Rebuilds an observe origin with fresh runtime source IDs.
    pub fn to_observe_origin(&self) -> Option<ObserveOrigin> {
        // Sources types can't be mixed in one session.
        let first = self.sources.first()?;

        match first {
            RecentSessionSource::File { .. } => {
                let mut files = Vec::with_capacity(self.sources.len());
                for source in &self.sources {
                    let RecentSessionSource::File { format, path } = source else {
                        warn!(
                            "Recent source snapshot contains mixed source types and cannot be restored"
                        );
                        return None;
                    };
                    files.push((Uuid::new_v4().to_string(), *format, path.clone()));
                }

                if files.len() == 1 {
                    let (id, format, path) = files.pop()?;
                    Some(ObserveOrigin::File(id, format, path))
                } else {
                    Some(ObserveOrigin::Concat(files))
                }
            }
            RecentSessionSource::Stream { transport } if self.sources.len() == 1 => Some(
                ObserveOrigin::Stream(Uuid::new_v4().to_string(), transport.clone()),
            ),
            //TODO AAZ: We Need to support restoring multiple sources.
            RecentSessionSource::Stream { .. } => None,
        }
    }

    /// Returns whether the source snapshot supports clean open through the setup flow.
    pub fn supports_clean_open(&self) -> bool {
        match self.sources.first() {
            Some(RecentSessionSource::File { .. }) => true,
            Some(RecentSessionSource::Stream { .. }) => self.sources.len() == 1,
            None => false,
        }
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

fn unix_timestamp_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or_default()
}

fn register_loaded_session(
    sessions: &mut Vec<RecentSessionSnapshot>,
    registration: RecentSessionSnapshot,
) {
    // Session exist => Move it to the top of list
    // otherwise => Insert it to the top of list to keep ordering correct.
    if let Some(index) = sessions
        .iter()
        .position(|session| session.source_key == registration.source_key)
    {
        sessions.remove(index);
    }

    sessions.insert(0, registration);

    // Newest-first ordering means the oldest entries are always at the tail.
    sessions.truncate(MAX_RECENT_SESSIONS);
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use stypes::{
        ObserveOptions, ObserveOrigin, ParserType, TCPTransportConfig, Transport,
        UDPTransportConfig,
    };

    use super::{
        LoadState, MAX_RECENT_SESSIONS, RecentSessionSnapshot, RecentSessionsData,
        RecentSessionsStorage, StorageError,
    };
    use crate::host::ui::storage::{RecentSessionSource, StorageErrorKind};

    fn test_storage() -> RecentSessionsStorage {
        RecentSessionsStorage::new()
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

    fn file_snapshot(path: PathBuf) -> RecentSessionSnapshot {
        RecentSessionSnapshot::from_observe_options(
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

    fn stream_snapshot(bind_addr: &str) -> RecentSessionSnapshot {
        RecentSessionSnapshot::from_observe_options(
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
    fn finish_load_keeps_loaded_data() {
        let valid_path = write_test_file("valid.log");
        let valid_snapshot = file_snapshot(valid_path.clone());
        let invalid_snapshot = file_snapshot(valid_path.with_file_name("missing.log"));
        let mut storage = test_storage();

        let error = storage.finish_load(Ok(Box::new(RecentSessionsData {
            sessions: vec![valid_snapshot.clone(), invalid_snapshot.clone()],
        })));

        assert!(error.is_none());
        assert!(!storage.dirty);
        let LoadState::Ready(data) = &storage.state else {
            panic!("storage should be ready");
        };
        assert_eq!(data.sessions.len(), 2);
        assert_eq!(data.sessions[0].source_key, valid_snapshot.source_key);
        assert_eq!(data.sessions[1].source_key, invalid_snapshot.source_key);
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
            LoadState::Ready(RecentSessionsData { sessions }) if sessions.is_empty()
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
    fn loading_replays_registration() {
        let mut storage = test_storage();
        let snapshot = named_snapshot("pending");
        let source_key = snapshot.source_key.clone();

        storage.register_session(snapshot);

        assert!(storage.get_save_data().is_none());
        assert!(
            storage
                .finish_load(Ok(Box::new(RecentSessionsData::default())))
                .is_none()
        );
        assert!(storage.dirty);

        let LoadState::Ready(data) = &storage.state else {
            panic!("storage should be ready");
        };

        assert_eq!(data.sessions.len(), 1);
        assert_eq!(data.sessions[0].source_key, source_key);
    }

    #[test]
    fn load_error_replays_registration() {
        let mut storage = test_storage();
        let snapshot = named_snapshot("fallback");
        let source_key = snapshot.source_key.clone();

        storage.register_session(snapshot);

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
        assert!(storage.dirty);

        let LoadState::Ready(data) = &storage.state else {
            panic!("storage should be ready");
        };

        assert_eq!(data.sessions.len(), 1);
        assert_eq!(data.sessions[0].source_key, source_key);
    }

    #[test]
    fn register_overwrites_same_source() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));

        let path = std::env::temp_dir().join("chipmunk-recent-storage-overwrite.log");
        let original = RecentSessionSnapshot::from_observe_options(
            "first title".into(),
            ObserveOptions::file(path.clone(), stypes::FileFormat::Text, ParserType::Text(())),
        );
        let replaced = RecentSessionSnapshot::from_observe_options(
            "second title".into(),
            ObserveOptions::file(
                path,
                stypes::FileFormat::Text,
                ParserType::SomeIp(stypes::SomeIpParserSettings {
                    fibex_file_paths: None,
                }),
            ),
        );

        storage.register_session(original.clone());
        storage.register_session(stream_snapshot("127.0.0.1:5555"));
        storage.register_session(replaced.clone());

        let LoadState::Ready(data) = &storage.state else {
            panic!("storage should be ready");
        };

        assert_eq!(data.sessions.len(), 2);
        assert_eq!(data.sessions[0].source_key, original.source_key);
        assert_eq!(data.sessions[0].title, "second title");
        assert!(matches!(data.sessions[0].parser, ParserType::SomeIp(..)));
    }

    #[test]
    fn register_trims_tail() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));

        for idx in 0..=MAX_RECENT_SESSIONS {
            storage.register_session(named_snapshot(&format!("session-{idx}")));
        }

        let LoadState::Ready(data) = &storage.state else {
            panic!("storage should be ready");
        };

        assert_eq!(data.sessions.len(), MAX_RECENT_SESSIONS);
        assert!(
            data.sessions[0]
                .title
                .ends_with(&format!("session-{MAX_RECENT_SESSIONS}.log"))
        );
        assert!(
            data.sessions[MAX_RECENT_SESSIONS - 1]
                .title
                .ends_with("session-1.log")
        );
    }

    #[test]
    fn remove_session_drops_snapshot() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));
        let snapshot = named_snapshot("single");
        let source_key = snapshot.source_key.clone();
        storage.register_session(snapshot);
        storage.apply_save_success();

        storage.remove_session(&source_key);

        assert!(storage.dirty);
        assert!(matches!(
            storage.state,
            LoadState::Ready(RecentSessionsData { sessions }) if sessions.is_empty()
        ));
    }

    #[test]
    fn save_success_clears_dirty() {
        let path = write_test_file("persisted.log");
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));
        storage.register_session(file_snapshot(path));

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
    fn restore_rebuilds_runtime_ids() {
        let snapshot = RecentSessionSnapshot::from_observe_options(
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

        let restored = snapshot
            .to_observe_options()
            .expect("observe options should be rebuilt");

        let ObserveOrigin::Concat(items) = restored.origin else {
            panic!("concat origin should be restored");
        };
        assert_eq!(items.len(), 2);
        assert_ne!(items[0].0, "first-id");
        assert_ne!(items[1].0, "second-id");
    }

    #[test]
    fn clean_open_support_matches_source_shape() {
        let files = RecentSessionSnapshot::from_observe_options(
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
            source_key: String::from("multi-stream"),
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
