//! Recent-sessions storage I/O.

use std::{
    fs::File,
    io::BufWriter,
    path::{Path, PathBuf},
};

use log::{info, warn};

use stypes::Transport;

use super::{chipmunk_home_dir, storage_path_from_home};
use crate::{
    host::{
        command::OpenRecentSessionParam,
        common::{parsers::ParserNames, sources::StreamNames},
        error::HostError,
        ui::storage::{
            recent::{
                session::{
                    RecentSessionReopenMode, RecentSessionSnapshot, RecentSessionSource,
                    RecentSessionStateSnapshot,
                },
                storage::{MAX_RECENT_SESSIONS, RecentSessionsStorage},
                validation::validate_sources,
            },
            types::{StorageError, StorageErrorKind},
        },
    },
    session::InitSessionError,
};

mod legacy;

const RECENT_SESSIONS_FILE: &str = "recent_sessions.json";

/// Host-side execution request derived from a stored recent-session snapshot.
#[derive(Debug)]
pub enum RecentSessionOpenRequest {
    /// Restore the session directly from rebuilt startup observe sources.
    Restore {
        options: Box<stypes::ObserveOptions>,
        additional_sources: Vec<stypes::ObserveOrigin>,
        restore_state: Option<RecentSessionStateSnapshot>,
    },
    /// Reopen one or more files through the normal host open flow.
    OpenFiles(Vec<PathBuf>),
    /// Reopen one or more files through plugin-parser setup.
    ///
    /// # Note:
    /// Plugins need to open text files without defaulting to text parser,
    /// therefore they need special command for them.
    OpenFilesWithPlugin(Vec<PathBuf>),
    /// Reopen a stream source by opening the setup flow with preselected types.
    OpenStreamSetup {
        stream: StreamNames,
        parser: ParserNames,
    },
}

/// Loads and normalizes recent sessions.
pub fn load_sessions() -> Result<RecentSessionsStorage, StorageError> {
    let home_dir = chipmunk_home_dir()?;
    load_sessions_from_home(&home_dir)
}

fn load_sessions_from_home(home_dir: &Path) -> Result<RecentSessionsStorage, StorageError> {
    let native_path = get_path_from_home(home_dir)?;

    run_legacy_import_hook(home_dir, &native_path);
    create_legacy_marker(home_dir, &native_path);

    load_and_normalize(&native_path)
}

fn get_path_from_home(home_dir: &Path) -> Result<PathBuf, StorageError> {
    storage_path_from_home(home_dir).map(|storage_dir| storage_dir.join(RECENT_SESSIONS_FILE))
}

/// Import recent session from legacy Chipmunk 3 on first time Chipmunk 4 is used.
fn run_legacy_import_hook(home_dir: &Path, native_path: &Path) {
    if native_path.exists()
        || legacy::marker_exists(home_dir)
        || !legacy::recent_actions_exists(home_dir)
    {
        return;
    }

    let imported_storage = match legacy::import_recent_sessions(home_dir) {
        Ok(storage) => storage,
        Err(err) => {
            warn!("Legacy recent-session import failed: {err}");
            RecentSessionsStorage::default()
        }
    };

    if let Err(err) = save_to_path(native_path, &imported_storage) {
        warn!(
            "Failed to create native recent-sessions storage at {} after legacy import: {err}",
            native_path.display()
        );
    }
}

/// Create marker file in Chipmunk 3 legacy storage to mark the storage as
/// already used to import legacy recent sessions into Chipmunk 4.
///
/// # Note:
///
/// We leave the marker in legacy Chipmunk to ensure that we will not re-import from
/// legacy again in case users removed Chipmunk 4 storage directory.
fn create_legacy_marker(home_dir: &Path, native_path: &Path) {
    if !native_path.exists() {
        return;
    }

    match legacy::create_marker(home_dir) {
        Ok(true) => info!(
            "Created legacy recent-session import marker at {}",
            legacy::marker_path(home_dir).display()
        ),
        Ok(false) => {}
        Err(err) => warn!(
            "Failed to create legacy recent-session import marker at {}: {err}",
            legacy::marker_path(home_dir).display()
        ),
    }
}

fn load_and_normalize(path: &Path) -> Result<RecentSessionsStorage, StorageError> {
    let mut storage = RecentSessionsStorage::load(path)?;

    if normalize_recent_sessions(&mut storage.sessions)
        && let Err(err) = save_to_path(path, &storage)
    {
        warn!(
            "Failed to persist normalized recent-sessions storage to {}: {err}",
            path.display()
        );
    }

    Ok(storage)
}

pub fn resolve_open_request(
    params: OpenRecentSessionParam,
) -> Result<RecentSessionOpenRequest, HostError> {
    let OpenRecentSessionParam {
        snapshot,
        mode,
        session_setup_id: _,
    } = params;

    match mode {
        RecentSessionReopenMode::RestoreSession => resolve_restore_request(snapshot, true),
        RecentSessionReopenMode::RestoreParserConfiguration => {
            resolve_restore_request(snapshot, false)
        }
        RecentSessionReopenMode::OpenClean => open_recent_session_clean(snapshot),
    }
}

fn resolve_restore_request(
    snapshot: RecentSessionSnapshot,
    restore_state: bool,
) -> Result<RecentSessionOpenRequest, HostError> {
    let (options, additional_sources) = snapshot.to_startup_restore_plan().ok_or_else(|| {
        HostError::InitSessionError(InitSessionError::Other(
            "Recent session snapshot cannot be restored.".into(),
        ))
    })?;

    let restore = RecentSessionOpenRequest::Restore {
        options: Box::new(options),
        additional_sources,
        restore_state: restore_state.then_some(snapshot.state),
    };

    Ok(restore)
}

fn open_recent_session_clean(
    snapshot: RecentSessionSnapshot,
) -> Result<RecentSessionOpenRequest, HostError> {
    let parser = ParserNames::from(&snapshot.parser);
    let sources = snapshot.into_sources();
    let source_count = sources.len();

    let Some(first_source) = sources.first().cloned() else {
        return Err(HostError::InitSessionError(InitSessionError::Other(
            "Recent session snapshot has no sources.".into(),
        )));
    };

    match first_source {
        RecentSessionSource::File { .. } => {
            let paths = sources
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

            match parser {
                ParserNames::Dlt | ParserNames::SomeIP | ParserNames::Text => {
                    Ok(RecentSessionOpenRequest::OpenFiles(paths))
                }
                // Plugins supports opening text file without defaulting to text parser
                ParserNames::Plugins => Ok(RecentSessionOpenRequest::OpenFilesWithPlugin(paths)),
            }
        }
        RecentSessionSource::Stream { transport } if source_count == 1 => {
            let stream = match transport {
                Transport::Process(_) => StreamNames::Process,
                Transport::TCP(_) => StreamNames::Tcp,
                Transport::UDP(_) => StreamNames::Udp,
                Transport::Serial(_) => StreamNames::Serial,
            };
            Ok(RecentSessionOpenRequest::OpenStreamSetup { stream, parser })
        }
        RecentSessionSource::Stream { .. } => {
            Err(HostError::InitSessionError(InitSessionError::Other(
                "Clean open is not supported for multiple stream sources.".into(),
            )))
        }
    }
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

    sessions.retain(|session| match validate_sources(session) {
        Ok(()) => true,
        Err(message) => {
            warn!(
                "Removed invalid recent session \"{}\" ({}): {message}",
                session.title(),
                session.source_key
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
        sessions.sort_unstable_by_key(|right| std::cmp::Reverse(right.last_opened));
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

/// Persists the current recent-sessions snapshot to its storage file.
pub fn save(data: &RecentSessionsStorage) -> Result<(), StorageError> {
    let path = get_path()?;
    save_to_path(&path, data)
}

fn save_to_path(path: &Path, data: &RecentSessionsStorage) -> Result<(), StorageError> {
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
    let home_dir = chipmunk_home_dir()?;
    get_path_from_home(&home_dir)
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        ops::Deref,
        path::{Path, PathBuf},
    };

    use processor::search::filter::SearchFilter;
    use stypes::{ObserveOptions, ObserveOrigin, ParserType, TCPTransportConfig, Transport};
    use tempfile::{TempDir, tempdir};

    use crate::{
        common::time::unix_timestamp_now,
        host::{
            command::OpenRecentSessionParam,
            service::storage::{STORAGE_DIR, storage_path_from_home},
            ui::storage::{
                recent::{
                    session::{
                        RecentSessionRegistration, RecentSessionReopenMode, RecentSessionSnapshot,
                        RecentSessionSource, SearchFilterSnapshot,
                    },
                    storage::{MAX_RECENT_SESSIONS, RecentSessionsStorage},
                },
                types::{StorageError, StorageErrorKind},
            },
        },
    };

    use super::*;

    struct TestHomeDir(TempDir);

    impl Deref for TestHomeDir {
        type Target = Path;

        fn deref(&self) -> &Self::Target {
            self.0.path()
        }
    }

    fn test_home_dir() -> TestHomeDir {
        TestHomeDir(tempdir().expect("temp home dir should be created"))
    }

    fn path_from_home(home_dir: &Path) -> Result<PathBuf, StorageError> {
        let storage_dir = storage_path_from_home(home_dir)?;
        Ok(storage_dir.join(RECENT_SESSIONS_FILE))
    }

    fn save_to_home(home_dir: &Path, data: &RecentSessionsStorage) -> Result<(), StorageError> {
        let path = path_from_home(home_dir)?;
        save_to_path(&path, data)
    }

    fn write_sessions_to_home(home_dir: &Path, sessions: Vec<RecentSessionSnapshot>) {
        let path = path_from_home(home_dir).expect("path should resolve");
        let json = serde_json::json!({ "sessions": sessions });
        fs::write(
            path,
            serde_json::to_vec_pretty(&json).expect("json should serialize"),
        )
        .expect("sessions should be written");
    }

    fn create_legacy_storage(home_dir: &Path) {
        fs::create_dir_all(legacy::storage_path(home_dir))
            .expect("legacy storage dir should be created");
    }

    fn create_legacy_recent_actions(home_dir: &Path) {
        write_legacy_recent_actions(home_dir, Vec::new());
    }

    fn write_legacy_recent_actions(home_dir: &Path, contents: Vec<serde_json::Value>) {
        create_legacy_storage(home_dir);
        let entries = contents
            .into_iter()
            .enumerate()
            .map(|(index, content)| {
                serde_json::json!({
                    "uuid": format!("entry-{index}"),
                    "content": content.to_string(),
                })
            })
            .collect::<Vec<_>>();
        fs::write(
            legacy::recent_actions_path(home_dir),
            serde_json::to_vec(&entries).expect("legacy entries should serialize"),
        )
        .expect("legacy recent actions should be written");
    }

    fn write_legacy_history_definitions(home_dir: &Path, contents: Vec<(&str, serde_json::Value)>) {
        let path = legacy::storage_path(home_dir).join("history_definitions_storage.storage");
        write_legacy_storage_entries(home_dir, &path, contents);
    }

    fn write_legacy_history_collections(home_dir: &Path, contents: Vec<(&str, serde_json::Value)>) {
        let path = legacy::storage_path(home_dir).join("history_collections_storage.storage");
        write_legacy_storage_entries(home_dir, &path, contents);
    }

    fn write_legacy_storage_entries(
        home_dir: &Path,
        path: &Path,
        contents: Vec<(&str, serde_json::Value)>,
    ) {
        create_legacy_storage(home_dir);
        let entries = contents
            .into_iter()
            .map(|(uuid, content)| {
                serde_json::json!({
                    "uuid": uuid,
                    "content": content.to_string(),
                })
            })
            .collect::<Vec<_>>();
        fs::write(
            path,
            serde_json::to_vec(&entries).expect("legacy entries should serialize"),
        )
        .expect("legacy storage entries should be written");
    }

    fn legacy_file_action(
        last: u64,
        format: &str,
        path: &Path,
        parser: serde_json::Value,
    ) -> serde_json::Value {
        let path = path.to_string_lossy();
        serde_json::json!({
            "stat": { "last": last },
            "observe": {
                "origin": { "File": ["source-id", format, path] },
                "parser": parser,
            }
        })
    }

    fn write_legacy_marker(home_dir: &Path) {
        create_legacy_storage(home_dir);
        fs::write(legacy::marker_path(home_dir), "").expect("legacy marker should be written");
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

    fn stream_snapshot(bind_addr: impl Into<String>) -> RecentSessionSnapshot {
        let bind_addr = bind_addr.into();
        snapshot_from_observe_options(ObserveOptions {
            origin: ObserveOrigin::Stream(
                String::new(),
                Transport::TCP(TCPTransportConfig { bind_addr }),
            ),
            parser: ParserType::Text(()),
        })
    }

    fn plugin_settings() -> stypes::PluginParserSettings {
        stypes::PluginParserSettings {
            plugin_path: PathBuf::from("/plugins/string_parser.wasm"),
            general_settings: stypes::PluginParserGeneralSettings {
                placeholder: String::new(),
            },
            plugin_configs: Vec::new(),
        }
    }

    fn recent_session(bind_addr: impl Into<String>, last_opened: u64) -> RecentSessionSnapshot {
        let mut session = stream_snapshot(bind_addr.into());
        session.last_opened = last_opened;
        session
    }

    #[test]
    fn missing_file_defaults() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");

        let data = RecentSessionsStorage::load(&path).expect("missing file should default");

        assert!(data.sessions.is_empty());
    }

    #[test]
    fn malformed_json_fails() {
        let home_dir = test_home_dir();
        let path = path_from_home(&home_dir).expect("path should resolve");
        fs::write(&path, "{not-json").expect("invalid json should be written");

        let err = RecentSessionsStorage::load(&path).expect_err("invalid json should fail");

        assert_eq!(err.kind, StorageErrorKind::Parse);
    }

    #[test]
    fn load_sessions_marks_existing_native_file() {
        let home_dir = test_home_dir();
        save_to_home(&home_dir, &RecentSessionsStorage::default()).expect("save should succeed");
        create_legacy_storage(&home_dir);

        load_sessions_from_home(&home_dir).expect("load should succeed");

        assert!(legacy::marker_path(&home_dir).exists());
    }

    #[test]
    fn load_sessions_does_not_create_missing_legacy_storage_for_marker() {
        let home_dir = test_home_dir();
        save_to_home(&home_dir, &RecentSessionsStorage::default()).expect("save should succeed");

        load_sessions_from_home(&home_dir).expect("load should succeed");

        assert!(!legacy::storage_path(&home_dir).exists());
        assert!(!legacy::marker_path(&home_dir).exists());
    }

    #[test]
    fn legacy_import_hook_creates_empty_native_file_and_marker() {
        let home_dir = test_home_dir();
        let native_path = path_from_home(&home_dir).expect("path should resolve");
        create_legacy_recent_actions(&home_dir);

        let loaded = load_sessions_from_home(&home_dir).expect("load should succeed");

        assert!(loaded.sessions.is_empty());
        assert!(native_path.exists());
        assert!(legacy::marker_path(&home_dir).exists());
        let saved = RecentSessionsStorage::load(&native_path).expect("created storage should load");
        assert!(saved.sessions.is_empty());
    }

    #[test]
    fn legacy_import_hook_writes_imported_native_file() {
        let home_dir = test_home_dir();
        let native_path = path_from_home(&home_dir).expect("path should resolve");
        let source_path = home_dir.join("legacy.log");
        fs::write(&source_path, "test").expect("source should exist for normalization");
        write_legacy_recent_actions(
            &home_dir,
            vec![legacy_file_action(
                1_700_000_123_456,
                "Text",
                &source_path,
                serde_json::json!({ "Text": null }),
            )],
        );

        let loaded = load_sessions_from_home(&home_dir).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), 1);
        assert_eq!(loaded.sessions[0].last_opened, 1_700_000_123);
        assert!(matches!(loaded.sessions[0].parser, ParserType::Text(())));
        assert!(native_path.exists());
        assert!(legacy::marker_path(&home_dir).exists());
    }

    #[test]
    fn legacy_import_failure_still_creates_empty_native_file() {
        let home_dir = test_home_dir();
        let native_path = path_from_home(&home_dir).expect("path should resolve");
        create_legacy_storage(&home_dir);
        fs::write(legacy::recent_actions_path(&home_dir), "{not-json")
            .expect("malformed legacy actions should be written");

        let loaded = load_sessions_from_home(&home_dir).expect("load should succeed");

        assert!(loaded.sessions.is_empty());
        assert!(native_path.exists());
        assert!(legacy::marker_path(&home_dir).exists());
        let saved = RecentSessionsStorage::load(&native_path).expect("created storage should load");
        assert!(saved.sessions.is_empty());
    }

    #[test]
    fn legacy_import_restores_matching_history_state() {
        let home_dir = test_home_dir();
        let source_path = home_dir.join("legacy-with-history.log");
        fs::write(&source_path, "test").expect("source should exist for normalization");
        write_legacy_recent_actions(
            &home_dir,
            vec![legacy_file_action(
                1_700_000_123_456,
                "Text",
                &source_path,
                serde_json::json!({ "Text": null }),
            )],
        );

        let source_path = source_path.to_string_lossy();
        write_legacy_history_definitions(
            &home_dir,
            vec![(
                "definition-id",
                serde_json::json!({
                    "observe": {
                        "origin": { "File": ["source-id", "Text", source_path] },
                        "parser": { "Text": null },
                    }
                }),
            )],
        );
        write_legacy_history_collections(
            &home_dir,
            vec![(
                "collection-id",
                serde_json::json!({
                    "d": ["definition-id"],
                    "l": 2,
                    "e": {
                        "filters": [{
                            "filter": {
                                "filter": "level=(warn|error)",
                                "reg": true,
                                "word": true,
                                "cases": true,
                            }
                        }],
                        "charts": [{ "filter": "cpu=(\\d+)" }],
                        "bookmark": [{ "position": 42 }],
                    }
                }),
            )],
        );

        let loaded = load_sessions_from_home(&home_dir).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), 1);
        let state = &loaded.sessions[0].state;
        assert_eq!(state.filters.len(), 1);
        let filter = &state.filters[0];
        assert_eq!(filter.filter.value, "level=(warn|error)");
        assert!(filter.filter.is_regex());
        assert!(filter.filter.is_word());
        assert!(!filter.filter.is_ignore_case());
        assert!(filter.enabled);
        assert_eq!(state.search_values.len(), 1);
        let chart = &state.search_values[0];
        assert_eq!(chart.filter.value, "cpu=(\\d+)");
        assert!(chart.filter.is_regex());
        assert!(chart.filter.is_ignore_case());
        assert!(chart.enabled);
        assert_eq!(state.bookmarks, vec![42]);
    }

    #[test]
    fn legacy_import_deduplicates_by_newest_source() {
        let home_dir = test_home_dir();
        let source_path = home_dir.join("duplicate.log");
        fs::write(&source_path, "test").expect("source should exist for normalization");
        write_legacy_recent_actions(
            &home_dir,
            vec![
                legacy_file_action(
                    1_000,
                    "Text",
                    &source_path,
                    serde_json::json!({ "Text": null }),
                ),
                legacy_file_action(
                    2_000,
                    "Text",
                    &source_path,
                    serde_json::json!({ "SomeIp": { "fibex_file_paths": ["/fibex/a.xml"] } }),
                ),
            ],
        );

        let loaded = load_sessions_from_home(&home_dir).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), 1);
        assert_eq!(loaded.sessions[0].last_opened, 2);
        assert!(matches!(loaded.sessions[0].parser, ParserType::SomeIp(..)));
    }

    #[test]
    fn legacy_imported_missing_file_is_dropped_by_normalization() {
        let home_dir = test_home_dir();
        let native_path = path_from_home(&home_dir).expect("path should resolve");
        let missing_path = home_dir.join("missing.log");
        write_legacy_recent_actions(
            &home_dir,
            vec![legacy_file_action(
                1_000,
                "Text",
                &missing_path,
                serde_json::json!({ "Text": null }),
            )],
        );

        let loaded = load_sessions_from_home(&home_dir).expect("load should succeed");

        assert!(loaded.sessions.is_empty());
        let saved =
            RecentSessionsStorage::load(&native_path).expect("normalized storage should load");
        assert!(saved.sessions.is_empty());
    }

    #[test]
    fn legacy_import_hook_skips_when_marker_exists() {
        let home_dir = test_home_dir();
        let native_path = path_from_home(&home_dir).expect("path should resolve");
        create_legacy_recent_actions(&home_dir);
        write_legacy_marker(&home_dir);

        let loaded =
            load_sessions_from_home(&home_dir).expect("missing native file should default");

        assert!(loaded.sessions.is_empty());
        assert!(!native_path.exists());
    }

    #[test]
    fn load_sessions_marks_malformed_native_before_parse_error() {
        let home_dir = test_home_dir();
        let native_path = path_from_home(&home_dir).expect("path should resolve");
        fs::write(&native_path, "{not-json").expect("invalid json should be written");
        create_legacy_storage(&home_dir);

        let err = load_sessions_from_home(&home_dir).expect_err("invalid json should fail");

        assert_eq!(err.kind, StorageErrorKind::Parse);
        assert!(legacy::marker_path(&home_dir).exists());
    }

    #[test]
    fn load_and_normalize_drops_missing_sources() {
        let home_dir = test_home_dir();
        let valid_path = home_dir.join("valid.log");
        fs::write(&valid_path, "test").expect("valid config file should be written");
        let invalid_path = home_dir.join("missing.log");
        let valid_snapshot = file_snapshot(valid_path);
        let invalid_snapshot = file_snapshot(invalid_path);
        let mut storage = RecentSessionsStorage::default();
        storage.register_session(valid_snapshot.clone());
        let mut data = storage.get_save_data().expect("dirty storage should save");
        data.sessions.push(invalid_snapshot);

        save_to_home(&home_dir, &data).expect("save should succeed");

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = load_and_normalize(&path).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), 1);
        assert_eq!(loaded.sessions[0].source_key, valid_snapshot.source_key);
    }

    #[test]
    fn keeps_plugin_session_without_plugin() {
        let home_dir = test_home_dir();
        let source_path = home_dir.join("plugin.log");
        fs::write(&source_path, "test").expect("source file should be written");
        let snapshot = snapshot_from_observe_options(ObserveOptions::file(
            source_path,
            stypes::FileFormat::Text,
            ParserType::Plugin(plugin_settings()),
        ));
        let mut storage = RecentSessionsStorage::default();
        storage.register_session(snapshot.clone());
        let data = storage.get_save_data().expect("dirty storage should save");

        save_to_home(&home_dir, &data).expect("save should succeed");

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = load_and_normalize(&path).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), 1);
        assert_eq!(loaded.sessions[0].source_key, snapshot.source_key);
    }

    #[test]
    fn load_and_normalize_keeps_clean_data() {
        let home_dir = test_home_dir();
        let config_path = home_dir.join("saved.log");
        fs::write(&config_path, "test").expect("config file should be written");
        let mut storage = RecentSessionsStorage::default();
        storage.register_session(file_snapshot(config_path));
        let data = storage.get_save_data().expect("dirty storage should save");

        save_to_home(&home_dir, &data).expect("save should succeed");

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = load_and_normalize(&path).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), 1);
    }

    #[test]
    fn load_and_normalize_sorts_sessions() {
        let home_dir = test_home_dir();
        write_sessions_to_home(
            &home_dir,
            vec![
                recent_session("oldest", 1),
                recent_session("newest", 3),
                recent_session("middle", 2),
            ],
        );

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = load_and_normalize(&path).expect("load should succeed");

        assert_eq!(loaded.sessions[0].title(), "newest");
        assert_eq!(loaded.sessions[1].title(), "middle");
        assert_eq!(loaded.sessions[2].title(), "oldest");
    }

    #[test]
    fn load_and_normalize_trims_sessions() {
        let home_dir = test_home_dir();
        write_sessions_to_home(
            &home_dir,
            (0..=MAX_RECENT_SESSIONS)
                .map(|idx| recent_session(format!("session-{idx}"), idx as u64))
                .collect(),
        );

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = load_and_normalize(&path).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), MAX_RECENT_SESSIONS);
        assert_eq!(
            loaded.sessions[0].title(),
            format!("session-{MAX_RECENT_SESSIONS}")
        );
        assert_eq!(
            loaded.sessions[MAX_RECENT_SESSIONS - 1].title(),
            "session-1"
        );
    }

    #[test]
    fn save_round_trips() {
        let home_dir = test_home_dir();
        let config_path = home_dir.join("saved.log");
        fs::write(&config_path, "test").expect("config file should be written");
        let mut storage = RecentSessionsStorage::default();
        let mut snapshot = file_snapshot(config_path);
        snapshot.state.filters = vec![SearchFilterSnapshot {
            filter: SearchFilter::plain("status=ok").ignore_case(true),
            enabled: false,
        }];
        snapshot.state.search_values = vec![SearchFilterSnapshot {
            filter: SearchFilter::plain("cpu=(\\d+)").regex(true),
            enabled: true,
        }];
        snapshot.state.bookmarks = vec![2, 9];
        storage.register_session(snapshot);
        let data = storage.get_save_data().expect("dirty storage should save");

        save_to_home(&home_dir, &data).expect("save should succeed");
        let saved_path = home_dir.join(STORAGE_DIR).join(RECENT_SESSIONS_FILE);
        assert!(saved_path.exists());
        let saved_json = fs::read_to_string(&saved_path).expect("saved file should be readable");
        assert!(!saved_json.contains("\"title\""));

        let path = path_from_home(&home_dir).expect("path should resolve");
        let loaded = RecentSessionsStorage::load(&path).expect("load should succeed");

        assert_eq!(loaded.sessions.len(), 1);
        assert_eq!(loaded.sessions[0].title(), data.sessions[0].title());
        assert_eq!(loaded.sessions[0].last_opened, data.sessions[0].last_opened);
        assert_eq!(loaded.sessions[0].source_key, data.sessions[0].source_key);
        assert_eq!(loaded.sessions[0].state, data.sessions[0].state);
    }

    #[test]
    fn restore_modes_split_state() {
        let mut snapshot = stream_snapshot("127.0.0.1:5555");
        snapshot.state.filters = vec![SearchFilterSnapshot {
            filter: SearchFilter::plain("status=ok"),
            enabled: true,
        }];

        let restore_request = resolve_open_request(OpenRecentSessionParam {
            snapshot: snapshot.clone(),
            mode: RecentSessionReopenMode::RestoreSession,
            session_setup_id: None,
        })
        .expect("restore request should resolve");
        let parser_request = resolve_open_request(OpenRecentSessionParam {
            snapshot,
            mode: RecentSessionReopenMode::RestoreParserConfiguration,
            session_setup_id: None,
        })
        .expect("parser restore request should resolve");

        match restore_request {
            RecentSessionOpenRequest::Restore {
                additional_sources,
                restore_state,
                ..
            } => {
                assert!(additional_sources.is_empty());
                assert!(restore_state.is_some());
            }
            other => panic!("expected restore request, got {other:?}"),
        }

        match parser_request {
            RecentSessionOpenRequest::Restore {
                additional_sources,
                restore_state,
                ..
            } => {
                assert!(additional_sources.is_empty());
                assert!(restore_state.is_none());
            }
            other => panic!("expected parser restore request, got {other:?}"),
        }
    }

    #[test]
    fn multi_stream_restore_splits_sources() {
        let snapshot = RecentSessionRegistration::new(
            unix_timestamp_now(),
            vec![
                RecentSessionSource::Stream {
                    transport: Transport::TCP(TCPTransportConfig {
                        bind_addr: String::from("127.0.0.1:5000"),
                    }),
                },
                RecentSessionSource::Stream {
                    transport: Transport::TCP(TCPTransportConfig {
                        bind_addr: String::from("127.0.0.1:5001"),
                    }),
                },
            ],
            ParserType::Text(()),
        )
        .into_snapshot(Default::default());

        let request = resolve_open_request(OpenRecentSessionParam {
            snapshot,
            mode: RecentSessionReopenMode::RestoreSession,
            session_setup_id: None,
        })
        .expect("multi-stream restore should resolve");

        match request {
            RecentSessionOpenRequest::Restore {
                options,
                additional_sources,
                ..
            } => {
                assert_eq!(additional_sources.len(), 1);
                assert!(matches!(options.origin, ObserveOrigin::Stream(_, _)));
                assert!(matches!(additional_sources[0], ObserveOrigin::Stream(_, _)));
            }
            other => panic!("expected restore request, got {other:?}"),
        }
    }

    #[test]
    fn multi_file_restore_uses_concat() {
        let snapshot = snapshot_from_observe_options(ObserveOptions {
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
        });

        let request = resolve_open_request(OpenRecentSessionParam {
            snapshot,
            mode: RecentSessionReopenMode::RestoreSession,
            session_setup_id: None,
        })
        .expect("multi-file restore should resolve");

        match request {
            RecentSessionOpenRequest::Restore {
                options,
                additional_sources,
                ..
            } => {
                assert!(additional_sources.is_empty());
                let ObserveOrigin::Concat(files) = options.origin else {
                    panic!("multi-file restore should use concat");
                };
                assert_eq!(files.len(), 2);
            }
            other => panic!("expected restore request, got {other:?}"),
        }
    }

    #[test]
    fn clean_open_plugin_file_uses_plugin_flow() {
        let path = PathBuf::from("plugin.log");
        let snapshot = snapshot_from_observe_options(ObserveOptions::file(
            path.clone(),
            stypes::FileFormat::Text,
            ParserType::Plugin(plugin_settings()),
        ));

        let request = resolve_open_request(OpenRecentSessionParam {
            snapshot,
            mode: RecentSessionReopenMode::OpenClean,
            session_setup_id: None,
        })
        .expect("plugin clean open should resolve");

        match request {
            RecentSessionOpenRequest::OpenFilesWithPlugin(paths) => {
                assert_eq!(paths, vec![path]);
            }
            other => panic!("expected plugin file open request, got {other:?}"),
        }
    }
}
