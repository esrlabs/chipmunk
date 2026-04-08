//! Recent-sessions storage I/O.

use std::{
    fs::File,
    io::{BufReader, BufWriter},
    path::{Path, PathBuf},
};

use log::{trace, warn};
use stypes::ObserveOrigin;
use tokio::sync::mpsc;

use super::storage_path;
use crate::host::ui::storage::{
    MAX_RECENT_SESSIONS, RecentSession, RecentSessionsData, SessionConfig, StorageError,
    StorageErrorKind, StorageEvent,
};

const RECENT_SESSIONS_FILE: &str = "recent_sessions.json";

/// Starts the background load for recent-sessions storage and publishes the result.
pub fn spawn_load(event_tx: mpsc::Sender<StorageEvent>) {
    tokio::task::spawn_blocking(move || {
        let result = get_path().and_then(|path| load(&path).map(|data| (path, data)));

        match result {
            Ok((path, mut data)) => {
                let invalid_removed = sanitize_recent_sessions(&mut data.sessions);
                let reordered = sort_recent_sessions(&mut data.sessions);
                let trimmed = trim_recent_sessions(&mut data.sessions);
                let changed = invalid_removed || reordered || trimmed;

                if changed && let Err(err) = save_to_path(&path, &data) {
                    warn!(
                        "Failed to persist normalized recent-sessions storage to {}: {err}",
                        path.display()
                    );
                }

                _ = event_tx.blocking_send(StorageEvent::RecentSessionsLoaded(Ok(data)));
            }
            Err(err) => {
                _ = event_tx.blocking_send(StorageEvent::RecentSessionsLoaded(Err(err)));
            }
        }
    });
}

fn load(path: &Path) -> Result<Box<RecentSessionsData>, StorageError> {
    let file = match File::open(path) {
        Ok(file) => file,
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

    serde_json::from_reader::<_, RecentSessionsData>(BufReader::new(file))
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

/// Removes invalid saved configurations in place.
///
/// Returns `true` if the session changed due to validations.
fn sanitize_recent_sessions(sessions: &mut Vec<RecentSession>) -> bool {
    let mut changed = false;

    sessions.retain_mut(|session| {
        session
            .configurations
            .retain(|config| match validate_session_config(config) {
                Ok(()) => true,
                Err(err) => {
                    changed = true;
                    warn!(
                        "Removed invalid recent configuration from session \"{}\": {config}: {err}",
                        session.title
                    );
                    false
                }
            });

        let keep = !session.configurations.is_empty();
        changed |= !keep;

        keep
    });

    changed
}

fn sort_recent_sessions(sessions: &mut [RecentSession]) -> bool {
    let changed = sessions
        .windows(2)
        .any(|pair| pair[0].last_opened < pair[1].last_opened);

    if changed {
        sessions.sort_unstable_by(|left, right| right.last_opened.cmp(&left.last_opened));
    }

    changed
}

fn trim_recent_sessions(sessions: &mut Vec<RecentSession>) -> bool {
    let changed = sessions.len() > MAX_RECENT_SESSIONS;

    if changed {
        sessions.truncate(MAX_RECENT_SESSIONS);
    }

    changed
}

fn validate_session_config(config: &SessionConfig) -> std::io::Result<()> {
    match &config.options.origin {
        ObserveOrigin::File(_, _, path) => {
            if path.exists() {
                Ok(())
            } else {
                Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("File not found: {}", path.display()),
                ))
            }
        }
        ObserveOrigin::Concat(files) => {
            for (_, _, path) in files {
                if !path.exists() {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        format!("File not found: {}", path.display()),
                    ));
                }
            }

            Ok(())
        }
        ObserveOrigin::Stream(_, _) => Ok(()),
    }
}

/// Persists the current recent-sessions snapshot to its storage file.
pub fn save(data: &RecentSessionsData) -> Result<(), StorageError> {
    let path = get_path()?;
    save_to_path(&path, data)
}

fn save_to_path(path: &Path, data: &RecentSessionsData) -> Result<(), StorageError> {
    let file = File::create(path).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to write '{}': {err}", path.display()),
    })?;

    serde_json::to_writer_pretty(BufWriter::new(file), data).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to serialize '{}': {err}", path.display()),
    })
}

fn get_path() -> Result<PathBuf, StorageError> {
    storage_path().map(|storage_dir| storage_dir.join(RECENT_SESSIONS_FILE))
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    use stypes::{ObserveOptions, ObserveOrigin, ParserType, TCPTransportConfig, Transport};

    use crate::host::service::storage::{STORAGE_DIR, storage_path_from_home};
    use crate::host::ui::storage::{
        MAX_RECENT_SESSIONS, RecentSession, RecentSessionsData, RecentSessionsStorage,
        SessionConfig, StorageError, StorageErrorKind,
    };

    use super::*;

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

    fn file_config(path: PathBuf) -> SessionConfig {
        SessionConfig::from_observe_options(ObserveOptions::file(
            path,
            stypes::FileFormat::Text,
            ParserType::Text(()),
        ))
        .expect("session config should be created")
    }

    fn stream_config(id: impl Into<String>) -> SessionConfig {
        SessionConfig {
            id: id.into(),
            options: ObserveOptions {
                origin: ObserveOrigin::Stream(
                    String::new(),
                    Transport::TCP(TCPTransportConfig {
                        bind_addr: "127.0.0.1:5555".into(),
                    }),
                ),
                parser: ParserType::Text(()),
            },
        }
    }

    fn recent_session(title: impl Into<String>, last_opened: u64) -> RecentSession {
        let title = title.into();

        RecentSession {
            configurations: vec![stream_config(title.clone())],
            title,
            last_opened,
        }
    }

    #[test]
    fn validate_accepts_existing_file() {
        let dir = test_home_dir();
        let path = dir.join("valid.log");
        fs::write(&path, "test").expect("test file should be written");
        let config = file_config(path);

        let result = validate_session_config(&config);

        assert!(result.is_ok());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn validate_rejects_missing_file() {
        let dir = test_home_dir();
        let config = file_config(dir.join("missing.log"));

        let result = validate_session_config(&config);

        assert!(matches!(result, Err(err) if err.kind() == std::io::ErrorKind::NotFound));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn validate_rejects_missing_concat_member() {
        let dir = test_home_dir();
        let valid_path = dir.join("first.log");
        fs::write(&valid_path, "test").expect("test file should be written");
        let missing_path = dir.join("second.log");
        let config = SessionConfig {
            id: "concat".into(),
            options: ObserveOptions {
                origin: ObserveOrigin::Concat(vec![
                    (String::new(), stypes::FileFormat::Text, valid_path),
                    (String::new(), stypes::FileFormat::Text, missing_path),
                ]),
                parser: ParserType::Text(()),
            },
        };

        let result = validate_session_config(&config);

        assert!(matches!(result, Err(err) if err.kind() == std::io::ErrorKind::NotFound));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn validate_accepts_stream_config() {
        let config = SessionConfig {
            id: "stream".into(),
            options: ObserveOptions {
                origin: ObserveOrigin::Stream(
                    String::new(),
                    Transport::TCP(TCPTransportConfig {
                        bind_addr: "127.0.0.1:5555".into(),
                    }),
                ),
                parser: ParserType::Text(()),
            },
        };

        let result = validate_session_config(&config);

        assert!(result.is_ok());
    }

    #[test]
    fn missing_file_defaults() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");

        let data = load(&path).expect("missing file should default");

        assert!(data.sessions.is_empty());
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
    fn load_cleanup_marks_changed() {
        let home_dir = test_home_dir();
        let valid_path = home_dir.join("valid.log");
        fs::write(&valid_path, "test").expect("valid config file should be written");
        let invalid_path = home_dir.join("missing.log");
        let valid_config = file_config(valid_path);
        let invalid_config = file_config(invalid_path);
        let mut storage = RecentSessionsStorage::new();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));
        storage.register_session("saved".into(), valid_config.clone());
        let mut data = storage.get_save_data().expect("dirty storage should save");
        data.sessions[0].configurations.push(invalid_config);

        save_to_home(&home_dir, &data).expect("save should succeed");

        let path = path_from_home(&home_dir).expect("path should resolve");
        let mut loaded = load(&path).expect("load should succeed");
        let invalid_removed = sanitize_recent_sessions(&mut loaded.sessions);
        let reordered = sort_recent_sessions(&mut loaded.sessions);
        let trimmed = trim_recent_sessions(&mut loaded.sessions);
        let changed = invalid_removed || reordered || trimmed;

        assert_eq!(loaded.sessions.len(), 1);
        assert_eq!(loaded.sessions[0].configurations.len(), 1);
        assert_eq!(loaded.sessions[0].configurations[0].id, valid_config.id);
        assert!(changed);
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn load_without_cleanup_stays_clean() {
        let home_dir = test_home_dir();
        let config_path = home_dir.join("saved.log");
        fs::write(&config_path, "test").expect("config file should be written");
        let mut storage = RecentSessionsStorage::new();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));
        storage.register_session("saved".into(), file_config(config_path));
        let data = storage.get_save_data().expect("dirty storage should save");

        save_to_home(&home_dir, &data).expect("save should succeed");

        let path = path_from_home(&home_dir).expect("path should resolve");
        let mut loaded = load(&path).expect("load should succeed");
        let invalid_removed = sanitize_recent_sessions(&mut loaded.sessions);
        let reordered = sort_recent_sessions(&mut loaded.sessions);
        let trimmed = trim_recent_sessions(&mut loaded.sessions);
        let changed = invalid_removed || reordered || trimmed;

        assert_eq!(loaded.sessions.len(), 1);
        assert!(!changed);
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn load_sorts_sessions() {
        let home_dir = test_home_dir();
        let data = RecentSessionsData {
            sessions: vec![
                recent_session("oldest", 1),
                recent_session("newest", 3),
                recent_session("middle", 2),
            ],
        };

        save_to_home(&home_dir, &data).expect("save should succeed");

        let path = path_from_home(&home_dir).expect("path should resolve");
        let mut loaded = load(&path).expect("load should succeed");
        let invalid_removed = sanitize_recent_sessions(&mut loaded.sessions);
        let reordered = sort_recent_sessions(&mut loaded.sessions);
        let trimmed = trim_recent_sessions(&mut loaded.sessions);
        let changed = invalid_removed || reordered || trimmed;

        assert!(changed);
        assert_eq!(loaded.sessions[0].title, "newest");
        assert_eq!(loaded.sessions[1].title, "middle");
        assert_eq!(loaded.sessions[2].title, "oldest");
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn load_trims_sessions() {
        let home_dir = test_home_dir();
        let data = RecentSessionsData {
            sessions: (0..=MAX_RECENT_SESSIONS)
                .map(|idx| recent_session(format!("session-{idx}"), idx as u64))
                .collect(),
        };

        save_to_home(&home_dir, &data).expect("save should succeed");

        let path = path_from_home(&home_dir).expect("path should resolve");
        let mut loaded = load(&path).expect("load should succeed");
        let invalid_removed = sanitize_recent_sessions(&mut loaded.sessions);
        let reordered = sort_recent_sessions(&mut loaded.sessions);
        let trimmed = trim_recent_sessions(&mut loaded.sessions);
        let changed = invalid_removed || reordered || trimmed;

        assert!(changed);
        assert_eq!(loaded.sessions.len(), MAX_RECENT_SESSIONS);
        assert_eq!(
            loaded.sessions[0].title,
            format!("session-{MAX_RECENT_SESSIONS}")
        );
        assert_eq!(loaded.sessions[MAX_RECENT_SESSIONS - 1].title, "session-1");
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn save_round_trips() {
        let home_dir = test_home_dir();
        let config_path = home_dir.join("saved.log");
        fs::write(&config_path, "test").expect("config file should be written");
        let mut storage = RecentSessionsStorage::new();
        storage.finish_load(Ok(Box::new(RecentSessionsData::default())));
        storage.register_session("saved".into(), file_config(config_path));
        let data = storage.get_save_data().expect("dirty storage should save");

        save_to_home(&home_dir, &data).expect("save should succeed");
        let saved_path = home_dir.join(STORAGE_DIR).join(RECENT_SESSIONS_FILE);
        assert!(saved_path.exists());

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = load(&path).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), 1);
        assert_eq!(loaded.sessions[0].title, data.sessions[0].title);
        assert_eq!(loaded.sessions[0].last_opened, data.sessions[0].last_opened);
        assert_eq!(
            loaded.sessions[0].configurations[0].id,
            data.sessions[0].configurations[0].id
        );
        let _ = fs::remove_dir_all(home_dir);
    }
}
