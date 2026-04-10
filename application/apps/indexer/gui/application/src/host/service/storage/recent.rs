//! Recent-sessions storage I/O.

use std::{
    fs::File,
    io::{BufReader, BufWriter},
    path::{Path, PathBuf},
};

use log::{trace, warn};

use stypes::Transport;

use super::storage_path;
use crate::{
    host::{
        command::OpenRecentSessionParam,
        common::{parsers::ParserNames, sources::StreamNames},
        error::HostError,
        ui::storage::{
            MAX_RECENT_SESSIONS, RecentSessionReopenMode, RecentSessionSnapshot,
            RecentSessionSource, RecentSessionsData, StorageError, StorageErrorKind,
        },
    },
    session::InitSessionError,
};

const RECENT_SESSIONS_FILE: &str = "recent_sessions.json";

/// Host-side execution request derived from a stored recent-session snapshot.
#[derive(Debug)]
pub enum RecentSessionOpenRequest {
    /// Restore the session directly from rebuilt observe options.
    Restore(Box<stypes::ObserveOptions>),
    /// Reopen one or more files through the normal host open flow.
    OpenFiles(Vec<PathBuf>),
    /// Reopen a stream source by opening the setup flow with preselected types.
    OpenStreamSetup {
        stream: StreamNames,
        parser: ParserNames,
    },
}

/// Loads and normalizes recent sessions.
pub fn load_sessions() -> Result<Box<RecentSessionsData>, StorageError> {
    let path = get_path()?;
    load_and_normalize(&path)
}

pub fn resolve_open_request(
    params: OpenRecentSessionParam,
) -> Result<RecentSessionOpenRequest, HostError> {
    let OpenRecentSessionParam { snapshot, mode } = params;

    match mode {
        RecentSessionReopenMode::RestoreSession
        | RecentSessionReopenMode::RestoreParserConfiguration => snapshot
            .to_observe_options()
            .map(Box::new)
            .map(RecentSessionOpenRequest::Restore)
            .ok_or_else(|| {
                HostError::InitSessionError(InitSessionError::Other(
                    "Recent session snapshot cannot be restored.".into(),
                ))
            }),
        RecentSessionReopenMode::OpenClean => open_recent_session_clean(snapshot),
    }
}

fn open_recent_session_clean(
    snapshot: RecentSessionSnapshot,
) -> Result<RecentSessionOpenRequest, HostError> {
    let Some(first_source) = snapshot.source.sources.first() else {
        return Err(HostError::InitSessionError(InitSessionError::Other(
            "Recent session snapshot has no sources.".into(),
        )));
    };

    match first_source {
        RecentSessionSource::File { .. } => {
            let paths = snapshot
                .source
                .sources
                .into_iter()
                .map(|source| match source {
                    RecentSessionSource::File { path, .. } => Some(path),
                    RecentSessionSource::Stream { .. } => None,
                })
                .collect::<Option<Vec<_>>>()
                .ok_or_else(|| {
                    HostError::InitSessionError(InitSessionError::Other(
                        "Recent session snapshot contains mixed source types.".into(),
                    ))
                })?;

            Ok(RecentSessionOpenRequest::OpenFiles(paths))
        }
        RecentSessionSource::Stream { transport } if snapshot.source.sources.len() == 1 => {
            let stream = match transport {
                Transport::Process(_) => StreamNames::Process,
                Transport::TCP(_) => StreamNames::Tcp,
                Transport::UDP(_) => StreamNames::Udp,
                Transport::Serial(_) => StreamNames::Serial,
            };
            let parser = ParserNames::from(&snapshot.parser);
            Ok(RecentSessionOpenRequest::OpenStreamSetup { stream, parser })
        }
        RecentSessionSource::Stream { .. } => {
            Err(HostError::InitSessionError(InitSessionError::Other(
                "Clean open is not supported for multiple stream sources.".into(),
            )))
        }
    }
}

fn load_and_normalize(path: &Path) -> Result<Box<RecentSessionsData>, StorageError> {
    let mut data = load(path)?;

    if normalize_recent_sessions(&mut data.sessions)
        && let Err(err) = save_to_path(path, &data)
    {
        warn!(
            "Failed to persist normalized recent-sessions storage to {}: {err}",
            path.display()
        );
    }

    Ok(data)
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

fn normalize_recent_sessions(sessions: &mut Vec<RecentSessionSnapshot>) -> bool {
    let invalid_removed = sanitize_recent_sessions(sessions);
    let reordered = sort_recent_sessions(sessions);
    let trimmed = trim_recent_sessions(sessions);

    invalid_removed || reordered || trimmed
}

/// Removes invalid recent snapshots in place.
///
/// Returns `true` if the collection changed due to validations.
fn sanitize_recent_sessions(sessions: &mut Vec<RecentSessionSnapshot>) -> bool {
    let initial_len = sessions.len();

    sessions.retain(|session| match validate_source_snapshot(session) {
        Ok(()) => true,
        Err(err) => {
            warn!(
                "Removed invalid recent session \"{}\" ({}): {err}",
                session.title, session.source_key
            );
            false
        }
    });

    sessions.len() != initial_len
}

fn sort_recent_sessions(sessions: &mut [RecentSessionSnapshot]) -> bool {
    let changed = sessions
        .windows(2)
        .any(|pair| pair[0].last_opened < pair[1].last_opened);

    if changed {
        sessions.sort_unstable_by(|left, right| right.last_opened.cmp(&left.last_opened));
    }

    changed
}

fn trim_recent_sessions(sessions: &mut Vec<RecentSessionSnapshot>) -> bool {
    let changed = sessions.len() > MAX_RECENT_SESSIONS;

    if changed {
        sessions.truncate(MAX_RECENT_SESSIONS);
    }

    changed
}

fn validate_source_snapshot(session: &RecentSessionSnapshot) -> std::io::Result<()> {
    if session.source.sources.is_empty() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Recent session has no sources",
        ));
    }

    for source in &session.source.sources {
        match source {
            RecentSessionSource::File { path, .. } => {
                if !path.exists() {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::NotFound,
                        format!("File not found: {}", path.display()),
                    ));
                }
            }
            RecentSessionSource::Stream { .. } => {}
        }
    }

    Ok(())
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
        MAX_RECENT_SESSIONS, RecentSessionSnapshot, RecentSessionsData, RecentSessionsStorage,
        StorageError, StorageErrorKind,
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

    fn file_snapshot(path: PathBuf) -> RecentSessionSnapshot {
        RecentSessionSnapshot::from_observe_options(
            path.file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("file")
                .to_owned(),
            ObserveOptions::file(path, stypes::FileFormat::Text, ParserType::Text(())),
        )
    }

    fn stream_snapshot(bind_addr: impl Into<String>) -> RecentSessionSnapshot {
        let bind_addr = bind_addr.into();
        RecentSessionSnapshot::from_observe_options(
            bind_addr.clone(),
            ObserveOptions {
                origin: ObserveOrigin::Stream(
                    String::new(),
                    Transport::TCP(TCPTransportConfig { bind_addr }),
                ),
                parser: ParserType::Text(()),
            },
        )
    }

    fn recent_session(title: impl Into<String>, last_opened: u64) -> RecentSessionSnapshot {
        let mut session = stream_snapshot(title.into());
        session.last_opened = last_opened;
        session
    }

    #[test]
    fn validate_accepts_existing_file() {
        let dir = test_home_dir();
        let path = dir.join("valid.log");
        fs::write(&path, "test").expect("test file should be written");
        let session = file_snapshot(path);

        let result = validate_source_snapshot(&session);

        assert!(result.is_ok());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn validate_rejects_missing_file() {
        let dir = test_home_dir();
        let session = file_snapshot(dir.join("missing.log"));

        let result = validate_source_snapshot(&session);

        assert!(matches!(result, Err(err) if err.kind() == std::io::ErrorKind::NotFound));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn validate_accepts_stream_snapshot() {
        let session = stream_snapshot("127.0.0.1:5555");

        let result = validate_source_snapshot(&session);

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
    fn load_and_normalize_drops_missing_sources() {
        let home_dir = test_home_dir();
        let valid_path = home_dir.join("valid.log");
        fs::write(&valid_path, "test").expect("valid config file should be written");
        let invalid_path = home_dir.join("missing.log");
        let valid_snapshot = file_snapshot(valid_path);
        let invalid_snapshot = file_snapshot(invalid_path);
        let mut storage = RecentSessionsStorage::new(RecentSessionsData::default());
        storage.register_session(valid_snapshot.clone());
        let mut data = storage.get_save_data().expect("dirty storage should save");
        data.sessions.push(invalid_snapshot);

        save_to_home(&home_dir, &data).expect("save should succeed");

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = load_and_normalize(&path).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), 1);
        assert_eq!(loaded.sessions[0].source_key, valid_snapshot.source_key);
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn load_and_normalize_keeps_clean_data() {
        let home_dir = test_home_dir();
        let config_path = home_dir.join("saved.log");
        fs::write(&config_path, "test").expect("config file should be written");
        let mut storage = RecentSessionsStorage::new(RecentSessionsData::default());
        storage.register_session(file_snapshot(config_path));
        let data = storage.get_save_data().expect("dirty storage should save");

        save_to_home(&home_dir, &data).expect("save should succeed");

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = load_and_normalize(&path).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), 1);
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn load_and_normalize_sorts_sessions() {
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
        let loaded = load_and_normalize(&path).expect("load should succeed");

        assert_eq!(loaded.sessions[0].title, "newest");
        assert_eq!(loaded.sessions[1].title, "middle");
        assert_eq!(loaded.sessions[2].title, "oldest");
        let _ = fs::remove_dir_all(home_dir);
    }

    #[test]
    fn load_and_normalize_trims_sessions() {
        let home_dir = test_home_dir();
        let data = RecentSessionsData {
            sessions: (0..=MAX_RECENT_SESSIONS)
                .map(|idx| recent_session(format!("session-{idx}"), idx as u64))
                .collect(),
        };

        save_to_home(&home_dir, &data).expect("save should succeed");

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = load_and_normalize(&path).expect("load should succeed");

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
        let mut storage = RecentSessionsStorage::new(RecentSessionsData::default());
        storage.register_session(file_snapshot(config_path));
        let data = storage.get_save_data().expect("dirty storage should save");

        save_to_home(&home_dir, &data).expect("save should succeed");
        let saved_path = home_dir.join(STORAGE_DIR).join(RECENT_SESSIONS_FILE);
        assert!(saved_path.exists());

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = load(&path).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), 1);
        assert_eq!(loaded.sessions[0].title, data.sessions[0].title);
        assert_eq!(loaded.sessions[0].last_opened, data.sessions[0].last_opened);
        assert_eq!(loaded.sessions[0].source_key, data.sessions[0].source_key);
        let _ = fs::remove_dir_all(home_dir);
    }
}
