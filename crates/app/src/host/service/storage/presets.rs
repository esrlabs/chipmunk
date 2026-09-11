//! Named-preset storage I/O.
//!
//! Presets are stored in the same versioned document format used by preset
//! import and export, so a stored file can be shared and imported as-is.

use std::path::{Path, PathBuf};

use log::{trace, warn};

use crate::host::{
    service::presets_io::{import_named_presets, serialize_named_presets},
    ui::storage::{
        presets::PresetsData,
        types::{StorageError, StorageErrorKind},
    },
};

use super::storage_path;

const PRESETS_FILE: &str = "presets.json";

/// Loads stored presets, defaulting to none when nothing is stored.
pub fn load() -> Result<PresetsData, StorageError> {
    let path = get_path()?;
    load_from_path(&path)
}

/// Persists the provided presets, replacing the stored document.
pub fn save(data: &PresetsData) -> Result<(), StorageError> {
    let path = get_path()?;
    save_to_path(&path, data)
}

fn load_from_path(path: &Path) -> Result<PresetsData, StorageError> {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            trace!("Presets storage file does not exist: {}", path.display());
            return Ok(PresetsData::default());
        }
        Err(err) => {
            warn!(
                "Failed to read presets storage from {}: {err}",
                path.display()
            );
            return Err(StorageError {
                kind: StorageErrorKind::Read,
                message: format!("Failed to read '{}': {err}", path.display()),
            });
        }
    };

    let report = import_named_presets(&text).map_err(|err| {
        warn!(
            "Failed to parse presets storage from {}: {err}",
            path.display()
        );
        StorageError {
            kind: StorageErrorKind::Parse,
            message: format!("Failed to parse '{}': {err}", path.display()),
        }
    })?;

    let data = PresetsData::new(report.presets);

    Ok(data)
}

fn save_to_path(path: &Path, data: &PresetsData) -> Result<(), StorageError> {
    let document = serialize_named_presets(data.presets.clone()).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to serialize '{}': {err}", path.display()),
    })?;

    std::fs::write(path, document).map_err(|err| StorageError {
        kind: StorageErrorKind::Write,
        message: format!("Failed to write '{}': {err}", path.display()),
    })
}

fn get_path() -> Result<PathBuf, StorageError> {
    storage_path().map(|storage_dir| storage_dir.join(PRESETS_FILE))
}

#[cfg(test)]
mod tests {
    use egui::Color32;
    use processor::search::filter::SearchFilter;
    use tempfile::tempdir;
    use uuid::Uuid;

    use crate::host::{
        common::colors::ColorPair,
        service::storage::storage_path_from_home,
        ui::registry::presets::{Preset, PresetFilterEntry, PresetSearchValueEntry},
    };

    use super::*;

    fn presets_path(home_dir: &Path) -> Result<PathBuf, StorageError> {
        storage_path_from_home(home_dir).map(|storage_dir| storage_dir.join(PRESETS_FILE))
    }

    fn preset(name: &str, pinned: bool) -> Preset {
        Preset {
            id: Uuid::new_v4(),
            name: name.to_owned(),
            pinned,
            filters: vec![PresetFilterEntry::new(
                SearchFilter::plain("error").ignore_case(true),
                false,
                ColorPair::new(
                    Color32::from_rgba_unmultiplied(1, 2, 3, 4),
                    Color32::from_rgba_unmultiplied(5, 6, 7, 8),
                ),
            )],
            search_values: vec![PresetSearchValueEntry::new(
                SearchFilter::plain("duration=(\\d+)")
                    .regex(true)
                    .ignore_case(true),
                true,
                Color32::from_rgba_unmultiplied(9, 10, 11, 12),
            )],
        }
    }

    #[test]
    fn missing_file_loads_no_presets() {
        let home_dir = tempdir().expect("temp home dir should be created");
        let path = presets_path(home_dir.path()).expect("presets path should be resolved");

        let data = load_from_path(&path).expect("missing presets file should load empty");

        assert!(data.presets.is_empty());
    }

    #[test]
    fn save_and_load_round_trip() {
        let home_dir = tempdir().expect("temp home dir should be created");
        let path = presets_path(home_dir.path()).expect("presets path should be resolved");
        let presets = vec![preset("Errors", true), preset("Durations", false)];
        let data = PresetsData::new(presets);

        save_to_path(&path, &data).expect("presets should save");
        let loaded = load_from_path(&path).expect("presets should load");

        assert_eq!(loaded.presets.len(), 2);
        for (loaded, saved) in loaded.presets.iter().zip(data.presets.iter()) {
            assert_eq!(loaded.name, saved.name);
            assert_eq!(loaded.pinned, saved.pinned);
            assert_eq!(loaded.filters, saved.filters);
            assert_eq!(loaded.search_values, saved.search_values);
        }
    }

    #[test]
    fn malformed_document_fails() {
        let home_dir = tempdir().expect("temp home dir should be created");
        let path = presets_path(home_dir.path()).expect("presets path should be resolved");
        std::fs::write(&path, "{not-json").expect("invalid document should be written");

        let err = load_from_path(&path).expect_err("invalid document should fail");

        assert_eq!(err.kind, StorageErrorKind::Parse);
    }
}
