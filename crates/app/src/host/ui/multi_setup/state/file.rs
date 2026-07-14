//! UI state for a file in the multi-file setup.

use std::{path::PathBuf, time::SystemTime};

use chrono::{DateTime, Local};
use egui::Color32;

use stypes::FileFormat;

use crate::host::common::file_utls;

#[derive(Debug)]
pub struct FileUiState {
    pub name: String,
    pub path: PathBuf,
    pub parent_path: Option<String>,
    pub format: FileFormat,
    pub size_bytes: Option<u64>,
    pub size_txt: Option<String>,
    /// Raw modification time used for chronological sorting.
    pub modified_at: Option<SystemTime>,
    pub last_modify: Option<String>,
    /// Inclusion state and positional source color.
    pub inclusion: FileInclusion,
}

/// Whether a file participates in the multi-file operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileInclusion {
    /// Included with its positional source color.
    Included(Color32),
    /// Excluded from the operation.
    Excluded,
}

impl FileInclusion {
    /// Returns whether the file participates in the operation.
    pub const fn is_included(self) -> bool {
        match self {
            Self::Included(_) => true,
            Self::Excluded => false,
        }
    }

    /// Returns the positional source color of an included file.
    pub const fn color(self) -> Option<Color32> {
        match self {
            Self::Included(color) => Some(color),
            Self::Excluded => None,
        }
    }
}

impl FileUiState {
    pub fn new(path: PathBuf, format: FileFormat, color: Color32) -> Self {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| String::from("Unknown"));

        let meta = std::fs::metadata(&path)
            .inspect_err(|err| {
                log::warn!(
                    "Retrieve metadata failed. File: {}. Error: {err:?}",
                    path.display()
                );
            })
            .ok();

        let size_bytes = meta.as_ref().map(|m| m.len());

        let size_txt = size_bytes.map(file_utls::format_file_size);

        let modified_at = meta.as_ref().and_then(|m| {
            m.modified()
                .inspect_err(|err| {
                    log::warn!(
                        "Get modified date for file {} failed. {err}.",
                        path.display()
                    );
                })
                .ok()
        });

        let last_modify = modified_at
            .map(DateTime::<Local>::from)
            .map(|dt| dt.format("%d/%m/%Y, %H:%M:%S").to_string());

        let parent_path = path.parent().map(|p| p.display().to_string());

        Self {
            name,
            path,
            parent_path,
            format,
            size_bytes,
            size_txt,
            modified_at,
            last_modify,
            inclusion: FileInclusion::Included(color),
        }
    }
}
