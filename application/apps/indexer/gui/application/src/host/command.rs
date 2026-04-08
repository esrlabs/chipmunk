use std::{path::PathBuf, sync::mpsc::Sender as StdSender};
use stypes::{FileFormat, ObserveOptions};
use uuid::Uuid;

use crate::host::{
    common::{parsers::ParserNames, sources::StreamNames},
    ui::{
        registry::presets::Preset,
        session_setup::state::{parsers::ParserConfig, sources::ByteSourceConfig},
        storage::{StorageError, StorageSaveData},
    },
};

/// Host commands to be sent from UI to its service.
#[derive(Debug, Clone)]
pub enum HostCommand {
    /// Open a new configuration from history.
    OpenNewConfiguration(Box<ObserveOptions>),
    /// Open a previous configuration from history.
    OpenPreviousConfiguration(Box<ObserveOptions>),
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
    DltStatistics(Box<DltStatisticsParam>),
    StartSession(Box<StartSessionParam>),
    /// Imports named presets from the provided file.
    ImportPresets(PathBuf),
    /// Exports the provided named presets to the target file.
    ExportPresets(Box<ExportPresetsParam>),
    /// Persists storage and notifies the caller when it finishes.
    SaveStorage {
        data: Box<StorageSaveData>,
        confirm_tx: StdSender<Result<(), StorageError>>,
    },
    CloseSessionSetup(Uuid),
    CloseMultiSetup(Uuid),
    /// Signal that the application is shutting down.
    OnShutdown {
        /// Channel is used to notify the UI when the back-end service
        /// has finished its cleanup tasks.
        confirm_tx: StdSender<()>,
    },
    CopyFiles {
        copy_file_infos: Vec<CopyFileInfo>,
    },
}

#[derive(Debug, Clone)]
pub struct DltStatisticsParam {
    pub session_setup_id: Uuid,
    pub source_paths: Vec<PathBuf>,
}

#[derive(Debug, Clone)]
pub struct StartSessionParam {
    pub parser: ParserConfig,
    pub source: ByteSourceConfig,
    pub session_setup_id: Option<Uuid>,
}

/// Parameters for exporting named presets to disk.
#[derive(Debug, Clone)]
pub struct ExportPresetsParam {
    /// Destination file path for the exported presets document.
    pub path: PathBuf,
    /// Preset snapshot to serialize, ignoring runtime-only registry ownership.
    pub presets: Vec<Preset>,
}

#[derive(Debug, Clone)]
pub struct CopyFileInfo {
    pub source: PathBuf,
    pub destination: PathBuf,
}
