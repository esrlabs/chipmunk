use std::path::PathBuf;

use stypes::FileFormat;
#[derive(Debug, Clone)]
pub struct SourceFileInfo {
    pub path: PathBuf,
    pub name: String,
    pub size_txt: String,
    pub format: FileFormat,
}

impl SourceFileInfo {
    pub fn new(path: PathBuf, name: String, size_txt: String, format: FileFormat) -> Self {
        Self {
            path,
            name,
            size_txt,
            format,
        }
    }

    pub fn is_valid(&self) -> bool {
        true
    }
}
