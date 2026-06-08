//! Host-service messages consumed by the native UI.

use std::path::PathBuf;

use uuid::Uuid;

use crate::{
    host::{
        common::dlt_stats::DltStatistics,
        ui::{
            multi_setup::state::MultiFileState,
            registry::presets::Preset,
            session_setup::state::SessionSetupState,
            state::plugin::PluginsState,
            storage::types::StorageEvent,
            update::{AppChangelog, AppVersionUpdate, DownloadedUpdate, UpdateCheckResult},
        },
    },
    session::SpawnedSession,
};

/// Messages sent from the host service to the UI.
#[derive(Debug)]
pub enum HostMessage {
    /// Open Session Setup with the provided state.
    SessionSetupOpened(Box<SessionSetupState>),
    /// Close session setup with the provided id.
    SessionSetupClosed { id: Uuid },
    /// Close multiple files setup with the provided id.
    MultiSetupClose { id: Uuid },
    /// The collected DLT statistics on a file for a SessionSetup
    DltStatistics {
        /// Setup tab that requested the statistics.
        setup_session_id: Uuid,
        /// Collected statistics, or `None` when collection failed.
        statistics: Option<Box<DltStatistics>>,
    },
    /// A new session has been successfully created.
    SessionCreated {
        session: Box<SpawnedSession>,
        /// ID for session_setup used to create this session to replace its tab
        /// instead of creating a new tab for the session.
        session_setup_id: Option<Uuid>,
    },
    /// Open Session Setup for concatenating files.
    MultiFilesSetup(Box<MultiFileState>),
    /// Presets loaded from a file and ready for UI-side registry import.
    PresetsImported(Box<PresetsImported>),
    /// Presets were exported successfully to the provided file path.
    PresetsExported {
        /// Destination file path.
        path: PathBuf,
        /// Number of exported presets.
        count: usize,
    },
    /// A newer application version was found by the quiet startup update check.
    AppVersionUpdate(Box<AppVersionUpdate>),
    /// Result of an explicit user-triggered update check.
    AppUpdateCheckResult(Box<UpdateCheckResult>),
    /// Built-in app update download result.
    AppUpdateDownload(Box<Result<DownloadedUpdate, String>>),
    /// Built-in app update install-on-exit result.
    AppUpdateInstall(Result<(), String>),
    /// Release notes for the first launch after an application update.
    AppChangelog(Box<AppChangelog>),
    /// Storage-related async events.
    Storage(StorageEvent),
    /// Plugin manager state published by the host service.
    PluginsStateChanged(Box<PluginsState>),
    /// README loading result for a Plugin Manager request.
    PluginReadmeLoaded(Box<PluginReadmeLoaded>),
}

/// Backend import result for named presets.
#[derive(Debug)]
pub struct PresetsImported {
    /// Source file used for the import.
    pub path: PathBuf,
    /// Parsed presets ready to be inserted into the registry.
    pub presets: Vec<Preset>,
    /// Import format detected by the backend parser.
    pub format: ImportFormat,
}

/// Import source recognized by the preset parser.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportFormat {
    /// Version 1 Chipmunk named preset document.
    Version1,
    /// Version 2 Chipmunk named preset document.
    Version2,
    /// Legacy Chipmunk V3 TypeScript frontend export.
    Legacy,
}

/// README loading result for a Plugin Manager request.
#[derive(Debug)]
pub struct PluginReadmeLoaded {
    /// UI-owned request id used to reject stale responses.
    pub request_id: u64,
    /// Plugin directory path used for the request.
    pub plugin_path: PathBuf,
    /// Loaded README state.
    pub result: PluginReadmeLoadResult,
}

/// Result of loading plugin README markdown.
#[derive(Debug)]
pub enum PluginReadmeLoadResult {
    /// README markdown content.
    Loaded(String),
    /// README path is unavailable or no longer exists.
    Missing,
    /// README loading failed.
    Error(String),
}
