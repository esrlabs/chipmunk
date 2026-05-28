//! Legacy Chipmunk 3 recent-session import paths, marker helpers, and parsers.
//!
//! # NOTE:
//!
//! This can be removed after multiple Chipmunk 4 releases when users have already
//! moved to the new version.
//!
//! At that point it would make sense to remove the old storage folder.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

use log::{info, warn};
use serde::Deserialize;
use serde_json::Value;

use crate::host::{
    common::parsers::ParserNames,
    ui::storage::recent::{session::RecentSessionSnapshot, storage::RecentSessionsStorage},
};

use self::{actions::parse_recent_action, history::LegacyHistory};

mod actions;
mod history;

const LEGACY_STORAGE_DIR: &str = "storage";
const LEGACY_RECENT_ACTIONS_FILE: &str = "user_recent_actions.storage";
const LEGACY_HISTORY_DEFINITIONS_FILE: &str = "history_definitions_storage.storage";
const LEGACY_HISTORY_COLLECTIONS_FILE: &str = "history_collections_storage.storage";
const IMPORT_MARKER_FILE: &str = "recent_imported_chipmunk_4";

/// Wrapper entry used by Chipmunk 3 `.storage` JSON arrays.
#[derive(Debug, Deserialize)]
struct LegacyStorageEntry {
    uuid: String,
    content: Value,
}

/// Accumulates imported snapshots and aggregate import counters.
struct ImportAccumulator {
    history: LegacyHistory,
    snapshots: Vec<RecentSessionSnapshot>,
    skipped: usize,
    history_matches: usize,
}

/// Finished legacy import result ready for native persistence.
struct ImportSummary {
    storage: RecentSessionsStorage,
    skipped: usize,
    history_matches: usize,
}

/// Returns the legacy Chipmunk 3 storage directory path.
pub fn storage_path(home_dir: &Path) -> PathBuf {
    home_dir.join(LEGACY_STORAGE_DIR)
}

/// Returns the legacy recent-actions storage file path.
pub fn recent_actions_path(home_dir: &Path) -> PathBuf {
    storage_path(home_dir).join(LEGACY_RECENT_ACTIONS_FILE)
}

fn history_definitions_path(home_dir: &Path) -> PathBuf {
    storage_path(home_dir).join(LEGACY_HISTORY_DEFINITIONS_FILE)
}

fn history_collections_path(home_dir: &Path) -> PathBuf {
    storage_path(home_dir).join(LEGACY_HISTORY_COLLECTIONS_FILE)
}

/// Returns the legacy import marker file path.
pub fn marker_path(home_dir: &Path) -> PathBuf {
    storage_path(home_dir).join(IMPORT_MARKER_FILE)
}

/// Returns whether the legacy recent-actions file exists.
pub fn recent_actions_exists(home_dir: &Path) -> bool {
    recent_actions_path(home_dir).exists()
}

/// Returns whether the legacy import marker exists.
pub fn marker_exists(home_dir: &Path) -> bool {
    marker_path(home_dir).exists()
}

/// Creates the legacy import marker only when the legacy storage directory exists.
pub fn create_marker(home_dir: &Path) -> io::Result<bool> {
    if !storage_path(home_dir).exists() {
        return Ok(false);
    }

    let marker_path = marker_path(home_dir);
    if marker_path.exists() {
        return Ok(false);
    }

    fs::write(
        marker_path,
        "Chipmunk 4 has already checked this Chipmunk 3 storage for recent sessions.\n",
    )?;
    Ok(true)
}

/// Imports Chipmunk 3 recent actions into the native recent-session model.
pub fn import_recent_sessions(home_dir: &Path) -> Result<RecentSessionsStorage, String> {
    info!("Legacy recent-session import started");

    let recent_actions_file = recent_actions_path(home_dir);
    let entries = load_storage_entries(&recent_actions_file)?;
    let mut accumulator = ImportAccumulator::new(home_dir);
    for entry in &entries {
        accumulator.import_entry(entry);
    }

    let import = accumulator.finish();
    info!(
        "Legacy recent-session import completed: action entries read={}, sessions imported={}, entries skipped={}, history collections matched={}",
        entries.len(),
        import.storage.sessions.len(),
        import.skipped,
        import.history_matches
    );

    Ok(import.storage)
}

fn load_storage_entries(path: &Path) -> Result<Vec<LegacyStorageEntry>, String> {
    let raw = fs::read_to_string(path).map_err(|err| {
        format!(
            "Failed to read legacy recent-actions storage '{}': {err}",
            path.display()
        )
    })?;

    serde_json::from_str(&raw).map_err(|err| {
        format!(
            "Failed to parse legacy recent-actions storage '{}': {err}",
            path.display()
        )
    })
}

fn load_optional_entries(path: &Path) -> Result<Vec<LegacyStorageEntry>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(path)
        .map_err(|err| format!("Failed to read '{}': {err}", path.display()))?;

    serde_json::from_str(&raw).map_err(|err| format!("Failed to parse '{}': {err}", path.display()))
}

impl ImportAccumulator {
    fn new(home_dir: &Path) -> Self {
        Self {
            history: LegacyHistory::load(home_dir),
            snapshots: Vec::new(),
            skipped: 0,
            history_matches: 0,
        }
    }

    fn import_entry(&mut self, entry: &LegacyStorageEntry) {
        let content = match entry.content_json() {
            Ok(content) => content,
            Err(err) => {
                self.skipped += 1;
                warn!("Skipping malformed legacy recent-action content: {err}");
                return;
            }
        };

        let mut snapshot = match parse_recent_action(&content) {
            Ok(snapshot) => snapshot,
            Err(err) => {
                self.skipped += 1;
                warn!(
                    "Skipping unsupported legacy recent-action {}: {err}",
                    entry.uuid
                );
                return;
            }
        };

        let parser_name = ParserNames::from(&snapshot.parser);
        if let Some(state) = self.history.state_for(snapshot.sources(), parser_name) {
            snapshot.state = state;
            snapshot.rebuild_cache();
            self.history_matches += 1;
        }

        self.snapshots.push(snapshot);
    }

    fn finish(mut self) -> ImportSummary {
        self.snapshots.sort_by_key(|snapshot| snapshot.last_opened);

        let mut storage = RecentSessionsStorage::default();
        for snapshot in self.snapshots {
            storage.register_session(snapshot);
        }

        ImportSummary {
            storage,
            skipped: self.skipped,
            history_matches: self.history_matches,
        }
    }
}

impl LegacyStorageEntry {
    fn content_json(&self) -> Result<Value, String> {
        match &self.content {
            Value::String(content) => serde_json::from_str(content).map_err(|err| err.to_string()),
            content => Ok(content.clone()),
        }
    }
}
