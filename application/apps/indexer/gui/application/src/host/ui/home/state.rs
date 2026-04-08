use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{fs, io::ErrorKind, path::PathBuf};

use crate::host::common::file_utls;

#[derive(Serialize, Deserialize, Default, Debug)]
pub struct HomeUiState {
    pub favorite_folders: Vec<FavoriteFolder>,

    #[serde(skip)]
    pub favorite_search: String,
    #[serde(skip)]
    pub favorite_collapse: bool,
}

impl HomeUiState {
    pub fn load(path: &std::path::Path) -> Self {
        let data = match fs::read_to_string(path) {
            Ok(data) => data,
            Err(err) if err.kind() == ErrorKind::NotFound => {
                return Self::default();
            }
            Err(err) => {
                log::error!(
                    "Failed to read home UI state from {}: {err}",
                    path.display()
                );
                return Self::default();
            }
        };

        let mut settings = match serde_json::from_str::<HomeUiState>(&data) {
            Ok(settings) => settings,
            Err(err) => {
                log::error!(
                    "Failed to parse home UI state from {}: {err}",
                    path.display()
                );
                return Self::default();
            }
        };

        settings.update_favorites();
        settings
    }

    pub fn save(&self, path: &std::path::Path) -> Result<()> {
        let data =
            serde_json::to_string_pretty(self).context("Failed to serialize home UI state")?;
        fs::write(path, data)
            .with_context(|| format!("Failed to write home UI state to {}", path.display()))
    }

    pub fn update_favorites(&mut self) {
        for folder in &mut self.favorite_folders {
            folder.scan();
        }

        self.favorite_folders.sort_by(|a, b| a.path.cmp(&b.path));
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FavoriteFolder {
    pub path: PathBuf,

    #[serde(skip)]
    pub files: Vec<FileUiInfo>,
}

#[derive(Debug, Clone)]
pub struct FileUiInfo {
    pub name: String,
    pub size_txt: String,
}

impl FileUiInfo {
    fn new(name: String, size_txt: String) -> Self {
        Self { name, size_txt }
    }
}

impl FavoriteFolder {
    pub fn new(path: PathBuf) -> Self {
        FavoriteFolder {
            path,
            files: vec![],
        }
    }

    pub fn scan(&mut self) {
        self.files.clear();

        let entries = match std::fs::read_dir(&self.path) {
            Ok(entries) => entries,
            Err(err) => {
                log::error!(
                    "Failed to scan favorite folder {}: {err}",
                    self.path.display()
                );
                return;
            }
        };

        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(err) => {
                    log::warn!(
                        "Failed to read an entry in favorite folder {}: {err}",
                        self.path.display()
                    );
                    continue;
                }
            };

            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(err) => {
                    log::warn!(
                        "Failed to read metadata for {} while scanning favorite folder {}: {err}",
                        entry.path().display(),
                        self.path.display()
                    );
                    continue;
                }
            };

            if metadata.file_type().is_symlink() {
                continue;
            }

            if metadata.is_file() {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.starts_with('.') {
                    continue;
                }

                let size = metadata.len();
                let size_info = file_utls::format_file_size(size);

                self.files.push(FileUiInfo::new(file_name, size_info));
            }
        }
    }
}
