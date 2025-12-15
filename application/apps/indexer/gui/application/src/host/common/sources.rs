use std::path::PathBuf;

use stypes::FileFormat;

#[derive(Debug, Clone)]
pub enum ByteSourceType {
    File(SourceFileInfo),
}

impl ByteSourceType {
    /// Checks if the source with the configurations is valid
    ///
    /// # Note:
    /// Function will be called in rendering loop and should be lightweight.
    pub fn is_valid(&self) -> bool {
        match self {
            ByteSourceType::File(..) => true,
        }
    }
}

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
}

// Slim source stream transport names to be used with the drop down.
#[derive(Debug, Clone, Copy)]
pub enum StreamNames {
    Process,
    Tcp,
    Udp,
    Serial,
}

impl StreamNames {
    pub const fn all() -> &'static [StreamNames] {
        // Reminder to add on new types
        match StreamNames::Process {
            StreamNames::Process => {}
            StreamNames::Tcp => {}
            StreamNames::Udp => {}
            StreamNames::Serial => {}
        };

        &[
            StreamNames::Process,
            StreamNames::Tcp,
            StreamNames::Udp,
            StreamNames::Serial,
        ]
    }
}
