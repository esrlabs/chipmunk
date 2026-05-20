//! App-version storage used to detect first launch after an update.

use std::{
    fs::{self, File},
    io::{BufReader, ErrorKind},
    path::{Path, PathBuf},
};

use log::warn;
use semver::Version;
use serde::{Deserialize, Serialize};

use crate::common::app_info;

use super::storage_path;

const APP_VERSION_FILE: &str = "app_version.json";

/// Persisted file shape; a named struct keeps the JSON field explicit.
#[derive(Debug, Deserialize, Serialize)]
struct PersistedAppVersion {
    last_seen_app_version: String,
}

/// Stores the current app version and returns the previously persisted version, if valid.
pub fn sync_current_version() -> Option<Version> {
    let path = match app_version_path() {
        Ok(path) => path,
        Err(err) => {
            warn!("Failed to resolve app-version storage path: {err}");
            return None;
        }
    };

    let previous_version = match read_previous_version(&path) {
        Ok(previous_version) => previous_version,
        Err(err) => {
            warn!(
                "Failed to read app-version storage from {}: {err}. Recreating the file.",
                path.display()
            );
            remove_invalid_file(&path);
            None
        }
    };

    if let Err(err) = write_current_version(&path, app_info::current_version()) {
        warn!(
            "Failed to write app-version storage to {}: {err}",
            path.display()
        );
    }

    previous_version
}

fn read_previous_version(path: &Path) -> Result<Option<Version>, String> {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(err) if err.kind() == ErrorKind::NotFound => return Ok(None),
        Err(err) => return Err(err.to_string()),
    };

    let persisted: PersistedAppVersion = serde_json::from_reader(BufReader::new(file))
        .map_err(|err| format!("failed to deserialize app-version storage: {err}"))?;

    let version = Version::parse(&persisted.last_seen_app_version)
        .map_err(|err| format!("failed to parse stored app version: {err}"))?;

    Ok(Some(version))
}

fn write_current_version(path: &Path, current_version: &Version) -> Result<(), String> {
    let persisted = PersistedAppVersion {
        last_seen_app_version: current_version.to_string(),
    };

    let content = serde_json::to_string_pretty(&persisted)
        .map_err(|err| format!("failed to serialize app-version storage: {err}"))?;

    fs::write(path, content).map_err(|err| err.to_string())
}

fn remove_invalid_file(path: &Path) {
    if let Err(err) = fs::remove_file(path)
        && err.kind() != ErrorKind::NotFound
    {
        warn!(
            "Failed to remove invalid app-version storage file {}: {err}",
            path.display()
        );
    }
}

fn app_version_path() -> Result<PathBuf, String> {
    storage_path()
        .map(|storage_dir| storage_dir.join(APP_VERSION_FILE))
        .map_err(|err| err.to_string())
}
