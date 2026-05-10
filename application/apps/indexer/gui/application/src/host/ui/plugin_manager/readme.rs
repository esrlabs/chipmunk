//! README loading state for the Plugin Manager.

use std::path::{Path, PathBuf};

use egui_commonmark::CommonMarkCache;

use crate::host::{
    message::{PluginReadmeLoadResult, PluginReadmeLoaded},
    ui::state::plugin::PluginsData,
};

/// README loading state for the selected plugin.
#[derive(Debug)]
pub struct ReadmeState {
    plugin_path: Option<PathBuf>,
    /// Current load status shown by the details view.
    pub status: ReadmeStatus,
    next_request_id: u64,
    /// Markdown renderer cache for the current README content.
    pub markdown_cache: CommonMarkCache,
}

/// README loading status for the selected plugin.
#[derive(Debug)]
pub enum ReadmeStatus {
    /// No README request has been started for the current selection.
    Idle,
    /// README content is being loaded by the host service.
    Loading { request_id: u64 },
    /// README content loaded successfully.
    Loaded { content: String },
    /// The selected plugin has no readable README path anymore.
    Missing,
    /// README loading failed.
    Error { message: String },
}

impl Default for ReadmeState {
    fn default() -> Self {
        Self {
            plugin_path: None,
            status: ReadmeStatus::Idle,
            next_request_id: 1,
            markdown_cache: CommonMarkCache::default(),
        }
    }
}

impl ReadmeState {
    /// Clears selected-plugin README state and markdown render cache.
    pub fn clear(&mut self) {
        let Self {
            plugin_path,
            status,
            next_request_id: _,
            markdown_cache,
        } = self;

        *plugin_path = None;
        *status = ReadmeStatus::Idle;
        *markdown_cache = CommonMarkCache::default();
    }

    /// Tracks the given plugin path and resets README status and render cache for a new path.
    pub fn reset_for(&mut self, path: &Path) {
        let Self {
            plugin_path,
            status,
            next_request_id: _,
            markdown_cache,
        } = self;

        if plugin_path
            .as_deref()
            .is_some_and(|current| current == path)
        {
            return;
        }

        *plugin_path = Some(path.to_path_buf());
        *status = ReadmeStatus::Idle;
        *markdown_cache = CommonMarkCache::default();
    }

    /// Prunes README state against available plugins, keeping only an installed plugin with README.
    pub fn retain_available(&mut self, data: &PluginsData) {
        let Some(plugin_path) = self.plugin_path.as_deref() else {
            return;
        };

        let still_available = data
            .installed
            .iter()
            .any(|plugin| plugin.dir_path == plugin_path && plugin.readme_path.is_some());

        if !still_available {
            self.clear();
        }
    }

    /// Marks the README as loading and returns the request id assigned to that load.
    pub fn start_loading(&mut self) -> u64 {
        let request_id = self.next_request_id;
        self.next_request_id = self.next_request_id.saturating_add(1).max(1);
        self.status = ReadmeStatus::Loading { request_id };
        request_id
    }

    /// Applies a matching README response and leaves stale responses unchanged.
    pub fn handle_response(&mut self, response: PluginReadmeLoaded) {
        let Some(plugin_path) = self.plugin_path.as_deref() else {
            return;
        };

        if plugin_path != response.plugin_path {
            return;
        }

        let request_id = match &self.status {
            ReadmeStatus::Loading { request_id } => *request_id,
            _ => return,
        };

        if request_id != response.request_id {
            return;
        }

        self.markdown_cache = CommonMarkCache::default();
        self.status = match response.result {
            PluginReadmeLoadResult::Loaded(content) => ReadmeStatus::Loaded { content },
            PluginReadmeLoadResult::Missing => ReadmeStatus::Missing,
            PluginReadmeLoadResult::Error(message) => ReadmeStatus::Error { message },
        };
    }
}
