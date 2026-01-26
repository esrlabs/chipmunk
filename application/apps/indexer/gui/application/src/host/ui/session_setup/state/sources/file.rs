use std::path::PathBuf;

use stypes::FileFormat;

#[derive(Debug, Clone)]
pub struct SourceFileInfo {
    pub path: PathBuf,
    pub name: String,
    pub size_byte: Option<u64>,
    pub format: FileFormat,
}

impl SourceFileInfo {
    pub fn new(path: PathBuf, format: FileFormat) -> Self {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| String::from("Unknown"));

        let size_byte = std::fs::metadata(&path)
            .inspect_err(|err| {
                log::warn!(
                    "Retrieve metadata failed. File: {}. Error: {err:?}",
                    path.display()
                );
            })
            .ok()
            .map(|m| m.len());

        Self {
            path,
            name,
            size_byte,
            format,
        }
    }

    pub fn is_valid(&self) -> bool {
        true
    }

    pub const fn validation_errors(&self) -> Vec<&str> {
        Vec::new()
    }
}
