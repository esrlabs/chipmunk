use std::path::PathBuf;

use stypes::FileFormat;
use uuid::Uuid;

use crate::host::{
    common::{parsers::ParserNames, sources::StreamNames},
    ui::session_setup::state::{parsers::ParserConfig, sources::ByteSourceConfig},
};

/// Host commands to be sent from UI to its service.
#[derive(Debug, Clone)]
pub enum HostCommand {
    /// Opens the files, prompting the user with the setup UI
    /// if multiple files are provided.
    OpenFiles(Vec<PathBuf>),
    /// Bypasses the setup UI and opens each file in a separate
    /// session immediately.
    OpenAsSessions(Vec<PathBuf>),
    /// Scans a directory for files matching the given format,
    /// then opens them via [`HostCommand::OpenFiles`].
    OpenFromDirectory {
        dir_path: PathBuf,
        target_format: FileFormat,
    },
    /// Concatenate the provided files grouping them via their format.
    /// This will start a session for text files directly or will open
    /// session setup for other file formats.
    ConcatFiles(Vec<(PathBuf, FileFormat)>),
    /// Opens sessions setup for connection sources.
    ConnectionSessionSetup {
        stream: StreamNames,
        parser: ParserNames,
    },
    StartSession(Box<StartSessionParam>),
    CloseSessionSetup(Uuid),
    CloseMultiSetup(Uuid),
    Close,
}

#[derive(Debug, Clone)]
pub struct StartSessionParam {
    pub parser: ParserConfig,
    pub source: ByteSourceConfig,
    pub session_setup_id: Option<Uuid>,
}
