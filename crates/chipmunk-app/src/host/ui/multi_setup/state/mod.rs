use std::path::PathBuf;

use stypes::FileFormat;
use uuid::Uuid;

mod file;

pub use file::FileUiState;

use crate::host::common;

#[derive(Debug)]
pub struct MultiFileState {
    id: Uuid,
    pub files: Vec<FileUiState>,
}

impl MultiFileState {
    pub fn new(files: Vec<(PathBuf, FileFormat)>) -> Self {
        let files = files
            .into_iter()
            .zip(
                common::colors::source_highlighting_colors()
                    .into_iter()
                    .cycle(),
            )
            .map(|((path, format), color)| FileUiState::new(path, format, color))
            .collect();

        Self {
            id: Uuid::new_v4(),
            files,
        }
    }

    pub fn id(&self) -> Uuid {
        self.id
    }
}
