//! Storage domain state for recent sessions.

use std::{
    fmt,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

use stypes::{FileFormat, ObserveOptions, ObserveOrigin, ParserType, Transport};

use super::{LoadState, StorageError};

pub(crate) const MAX_RECENT_SESSIONS: usize = 100;

/// Storage state for the recent-sessions domain.
#[derive(Debug)]
pub struct RecentSessionsStorage {
    pub state: LoadState<RecentSessionsData>,
    // `register_session` can run before the async load finishes during startup.
    pending_registrations: Vec<RecentSession>,
    /// True when the in-memory data still needs to be saved.
    pub dirty: bool,
}

/// Recent-sessions storage data.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RecentSessionsData {
    /// Stored in descending `last_opened` order because the home screen renders this list as-is.
    pub sessions: Vec<RecentSession>,
}

/// One entry in the recent-sessions collection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentSession {
    /// Session title shown in the recent-sessions list.
    pub title: String,
    /// Unix timestamp used to keep the list newest-first.
    pub last_opened: u64,
    /// Saved configurations grouped under this recent session entry.
    pub configurations: Vec<SessionConfig>,
}

/// Persisted configuration snapshot for reopening a recent session entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    /// The unique hash of the config.
    /// TODO AAZ: This should be removed as the each recent session can have one custom
    /// configurations only (needed once we add bookmarks and filters).
    pub id: String,
    /// The observe options of the config.
    pub options: ObserveOptions,
}

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
    pub fn register_session(&mut self, title: String, config: SessionConfig) {
        let registration = RecentSession {
            title,
            last_opened: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or_default(),
            configurations: vec![config],
        };

        match &mut self.state {
            LoadState::Ready(data) => {
                register_loaded_session(&mut data.sessions, registration);
                self.dirty = true;
            }
            LoadState::Loading => {
                // Startup opens can happen before the async load completes. Buffer them so the
                // loaded snapshot can replay the same newest-first mutations once it arrives.
                self.pending_registrations.push(registration);
            }
        }
    }

    /// Removes a recent session entry by title.
    pub fn remove_session(&mut self, title: &str) {
        let LoadState::Ready(data) = &mut self.state else {
            return;
        };

        let initial_len = data.sessions.len();
        data.sessions.retain(|session| session.title != title);
        self.dirty |= data.sessions.len() != initial_len;
    }

    /// Removes one saved configuration and drops the session if it becomes empty.
    pub fn remove_configuration(&mut self, title: &str, config_id: &str) {
        let LoadState::Ready(data) = &mut self.state else {
            return;
        };

        let Some(session) = data
            .sessions
            .iter_mut()
            .find(|session| session.title == title)
        else {
            return;
        };

        let initial_len = session.configurations.len();
        session
            .configurations
            .retain(|config| config.id != config_id);
        let removed = session.configurations.len() != initial_len;

        if session.configurations.is_empty() {
            data.sessions.retain(|session| session.title != title);
        }

        self.dirty |= removed;
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

impl RecentSession {
    /// Returns a reusable configuration template when this session supports cloning.
    pub fn new_configuration(&self) -> Option<&SessionConfig> {
        self.configurations
            .first()
            .and_then(|cfg| match &cfg.options.origin {
                ObserveOrigin::File(_, format, _) if *format == FileFormat::Text => None,
                ObserveOrigin::File(..) | ObserveOrigin::Concat(..) => Some(cfg),
                ObserveOrigin::Stream(..) => None,
            })
    }
}

impl SessionConfig {
    /// Builds a stored configuration snapshot and stable ID from observe options.
    pub fn from_observe_options(options: ObserveOptions) -> Option<Self> {
        let opts = ObserveOptions {
            // NOTE: We need to zero the id element because we are hashing the items and we want the
            // hash to be the same.
            origin: match options.origin {
                ObserveOrigin::File(_, format, path) => {
                    ObserveOrigin::File(String::new(), format, path)
                }
                ObserveOrigin::Concat(files) => ObserveOrigin::Concat(
                    files
                        .into_iter()
                        .map(|(_, format, path)| (String::new(), format, path))
                        .collect(),
                ),
                ObserveOrigin::Stream(_, transport) => {
                    ObserveOrigin::Stream(String::new(), transport.clone())
                }
            },
            parser: options.parser.clone(),
        };

        //TODO AAZ: This shouldn't end in the final solution when the storage PR is merged.
        if let Ok(json) = serde_json::to_string_pretty(&opts) {
            Some(SessionConfig {
                id: blake3::hash(json.as_bytes()).to_hex().to_string(),
                options: opts,
            })
        } else {
            None
        }
    }
}

impl fmt::Display for SessionConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.options.origin {
            ObserveOrigin::File(_, _, _) => {
                // The session title already names file-based entries.
            }
            ObserveOrigin::Concat(files) => {
                write!(f, "[ ")?;
                for (_, _, path) in files {
                    write!(f, "{} ", file_name(path))?;
                }
                write!(f, "] ")?;
            }
            ObserveOrigin::Stream(_, transport) => match transport {
                Transport::Process(_) => {
                    write!(f, "CMD ")?;
                }
                Transport::Serial(_) => {
                    write!(f, "Serial ")?;
                }
                Transport::UDP(_) => {
                    write!(f, "UDP ")?;
                }
                Transport::TCP(_) => {
                    write!(f, "TCP ")?;
                }
            },
        };

        match &self.options.parser {
            ParserType::Dlt(settings) => {
                write!(f, "DLT")?;
                if let Some(filter) = &settings.filter_config {
                    match filter.min_log_level {
                        Some(1) => write!(f, " FATAL")?,
                        Some(2) => write!(f, " ERROR")?,
                        Some(3) => write!(f, " WARN")?,
                        Some(4) => write!(f, " INFO")?,
                        Some(5) => write!(f, " DEBUG")?,
                        Some(6) => write!(f, " VERBOSE")?,
                        _ => {}
                    };
                    if let Some(ecus) = &filter.ecu_ids
                        && !ecus.is_empty()
                    {
                        write!(f, ", ECUs: {}", ecus.len())?;
                    }
                    if filter.app_id_count > 0 {
                        write!(f, ", APPs: {}", filter.app_id_count)?;
                    }
                    if filter.context_id_count > 0 {
                        write!(f, ", CTXs: {}", filter.context_id_count)?;
                    }
                }
                if let Some(paths) = &settings.fibex_file_paths
                    && !paths.is_empty()
                {
                    write!(f, ", Fibex:")?;
                    for path in paths {
                        write!(f, " {}", file_name(&PathBuf::from(path)))?;
                    }
                }
            }
            ParserType::SomeIp(settings) => {
                write!(f, "SOME/IP")?;
                if let Some(paths) = &settings.fibex_file_paths
                    && !paths.is_empty()
                {
                    write!(f, ", Fibex:")?;
                    for path in paths {
                        write!(f, " {}", file_name(&PathBuf::from(path)))?;
                    }
                }
            }
            ParserType::Text(()) => {
                write!(f, "Text")?;
            }
            ParserType::Plugin(settings) => {
                write!(f, "Plugin ({})", file_name(&settings.plugin_path))?;
            }
        };

        Ok(())
    }
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|file| file.to_str())
        .map(|name| name.to_string())
        .unwrap_or_else(|| format!("{}", path.display()))
}

fn register_loaded_session(sessions: &mut Vec<RecentSession>, registration: RecentSession) {
    let RecentSession {
        title,
        last_opened,
        mut configurations,
    } = registration;

    let Some(config) = configurations.pop() else {
        return;
    };

    if let Some(index) = sessions.iter().position(|session| session.title == title) {
        // Reopening an existing session updates its recency, merges any new configuration,
        // and moves the entry to the front.
        let mut entry = sessions.remove(index);
        entry.last_opened = last_opened;

        if !entry
            .configurations
            .iter()
            .any(|existing| existing.id == config.id)
        {
            entry.configurations.push(config);
        }

        sessions.insert(0, entry);
    } else {
        // A brand new session is always the newest entry because its open timestamp is created
        // when `register_session` is called.
        sessions.insert(
            0,
            RecentSession {
                title,
                last_opened,
                configurations: vec![config],
            },
        );
    }

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

    use stypes::{ObserveOptions, ParserType};

    use super::{
        LoadState, MAX_RECENT_SESSIONS, RecentSession, RecentSessionsData, RecentSessionsStorage,
        SessionConfig, StorageError,
    };
    use crate::host::ui::storage::StorageErrorKind;

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

    fn file_config(path: PathBuf) -> SessionConfig {
        SessionConfig::from_observe_options(ObserveOptions::file(
            path,
            stypes::FileFormat::Text,
            ParserType::Text(()),
        ))
        .expect("session config should be created")
    }

    fn named_config(name: &str) -> SessionConfig {
        file_config(std::env::temp_dir().join(format!("chipmunk-recent-storage-test-{name}.log")))
    }

    #[test]
    fn finish_load_keeps_loaded_data() {
        let valid_path = write_test_file("valid.log");
        let valid_config = file_config(valid_path.clone());
        let invalid_config = file_config(valid_path.with_file_name("missing.log"));
        let invalid_config_id = invalid_config.id.clone();
        let mut storage = test_storage();

        let error = storage.finish_load(Ok(Box::new(RecentSessionsData {
            sessions: vec![
                RecentSession {
                    title: "keep".into(),
                    last_opened: 2,
                    configurations: vec![valid_config.clone(), invalid_config],
                },
                RecentSession {
                    title: "drop".into(),
                    last_opened: 1,
                    configurations: vec![file_config(
                        valid_path.with_file_name("also-missing.log"),
                    )],
                },
            ],
        })));

        assert!(error.is_none());
        assert!(!storage.dirty);
        let LoadState::Ready(data) = &storage.state else {
            panic!("storage should be ready");
        };
        assert_eq!(data.sessions.len(), 2);
        assert_eq!(data.sessions[0].title, "keep");
        assert_eq!(data.sessions[0].last_opened, 2);
        assert_eq!(data.sessions[0].configurations.len(), 2);
        assert_eq!(data.sessions[0].configurations[0].id, valid_config.id);
        assert_eq!(data.sessions[0].configurations[1].id, invalid_config_id);
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
        let config = named_config("pending");
        let config_id = config.id.clone();

        storage.register_session("pending".into(), config);

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
        assert_eq!(data.sessions[0].title, "pending");
        assert_eq!(data.sessions[0].configurations[0].id, config_id);
    }

    #[test]
    fn load_error_replays_registration() {
        let mut storage = test_storage();
        let config = named_config("fallback");
        let config_id = config.id.clone();

        storage.register_session("fallback".into(), config);

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
        assert_eq!(data.sessions[0].title, "fallback");
        assert_eq!(data.sessions[0].configurations[0].id, config_id);
    }

    #[test]
    fn register_moves_existing_front() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));

        storage.register_session("first".into(), named_config("first-a"));
        storage.register_session("second".into(), named_config("second-a"));
        storage.register_session("first".into(), named_config("first-b"));

        assert!(storage.dirty);
        let LoadState::Ready(data) = &storage.state else {
            panic!("storage should be ready");
        };

        assert_eq!(data.sessions.len(), 2);
        assert_eq!(data.sessions[0].title, "first");
        assert_eq!(data.sessions[0].configurations.len(), 2);
        assert_eq!(data.sessions[1].title, "second");
    }

    #[test]
    fn register_trims_tail() {
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));

        for idx in 0..=MAX_RECENT_SESSIONS {
            storage.register_session(
                format!("session-{idx}"),
                named_config(&format!("session-{idx}")),
            );
        }

        let LoadState::Ready(data) = &storage.state else {
            panic!("storage should be ready");
        };

        assert_eq!(data.sessions.len(), MAX_RECENT_SESSIONS);
        assert_eq!(
            data.sessions[0].title,
            format!("session-{MAX_RECENT_SESSIONS}")
        );
        assert_eq!(data.sessions[MAX_RECENT_SESSIONS - 1].title, "session-1");
    }

    #[test]
    fn remove_configuration_drops_empty_session() {
        let path = write_test_file("single.log");
        let config = file_config(path);
        let config_id = config.id.clone();
        let mut storage = test_storage();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));
        storage.register_session("single".into(), config);
        storage.apply_save_success();

        storage.remove_configuration("single", &config_id);

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
        storage.register_session("saved".into(), file_config(path));

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
}
