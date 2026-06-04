//! Application settings storage I/O.

use std::{
    fs::File,
    io::{BufReader, BufWriter},
    path::{Path, PathBuf},
};

use log::{trace, warn};

use super::storage_path;
use crate::host::ui::storage::{
    settings::AppSettings,
    types::{StorageError, StorageErrorKind},
};

const APP_SETTINGS_FILE: &str = "app_settings.json";

/// Loads application settings from disk.
pub fn load_settings() -> Result<AppSettings, StorageError> {
    let path = get_path()?;
    load(&path)
}

/// Persists application settings to disk.
pub fn save_settings(settings: &AppSettings) -> Result<(), StorageError> {
    let path = get_path()?;
    save_to_path(&path, settings)
}

fn load(path: &Path) -> Result<AppSettings, StorageError> {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            trace!(
                "Application settings file does not exist: {}",
                path.display()
            );
            return Ok(AppSettings::default());
        }
        Err(err) => {
            warn!(
                "Failed to read application settings from {}: {err}",
                path.display()
            );
            return Err(StorageError {
                kind: StorageErrorKind::Read,
                message: format!("Failed to read '{}': {err}", path.display()),
            });
        }
    };

    serde_json::from_reader(BufReader::new(file)).map_err(|err| {
        warn!(
            "Failed to parse application settings from {}: {err}",
            path.display()
        );

        StorageError {
            kind: StorageErrorKind::Parse,
            message: format!("Failed to parse '{}': {err}", path.display()),
        }
    })
}

fn save_to_path(path: &Path, settings: &AppSettings) -> Result<(), StorageError> {
    let file = File::create(path).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to write '{}': {err}", path.display()),
    })?;

    serde_json::to_writer_pretty(BufWriter::new(file), settings).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to serialize '{}': {err}", path.display()),
    })
}

fn get_path() -> Result<PathBuf, StorageError> {
    storage_path().map(|storage_dir| storage_dir.join(APP_SETTINGS_FILE))
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use tempfile::tempdir;

    use crate::host::{
        service::storage::storage_path_from_home,
        ui::storage::settings::{AppSettings, UpdateSettings},
    };

    use super::*;

    fn test_settings_path(home_dir: &Path) -> Result<PathBuf, StorageError> {
        let storage_dir = storage_path_from_home(home_dir)?;
        Ok(storage_dir.join(APP_SETTINGS_FILE))
    }

    #[test]
    fn missing_file_loads_default_settings() {
        let home_dir = tempdir().expect("temp home dir should be created");
        let path = test_settings_path(home_dir.path()).expect("settings path should be resolved");

        let settings = load(&path).expect("missing settings file should load defaults");

        assert_eq!(settings, AppSettings::default());
    }

    #[test]
    fn save_and_load_round_trip() {
        let home_dir = tempdir().expect("temp home dir should be created");
        let path = test_settings_path(home_dir.path()).expect("settings path should be resolved");
        let settings = AppSettings {
            updates: UpdateSettings {
                check_for_updates: false,
                check_pre_releases: true,
            },
        };

        save_to_path(&path, &settings).expect("settings should save");
        let loaded = load(&path).expect("settings should load");

        assert_eq!(loaded, settings);
    }
}
