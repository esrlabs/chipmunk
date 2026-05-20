//! UI state for application metadata and update presentation.

use egui_commonmark::CommonMarkCache;

use crate::host::message::{AppChangelog, AppVersionUpdate};

/// UI state for application information.
#[derive(Debug, Default)]
pub struct AppInfoState {
    update_info: Option<AppVersionUpdate>,
    changelog: Option<AppChangelog>,
    changelog_markdown_cache: CommonMarkCache,
    pub show_update_banner: bool,
}

impl AppInfoState {
    /// Returns the latest known update information, if any.
    pub fn update_info(&self) -> Option<&AppVersionUpdate> {
        self.update_info.as_ref()
    }

    /// Stores new update information and shows the update banner.
    pub fn set_update_info(&mut self, update_info: AppVersionUpdate) {
        self.update_info = Some(update_info);
        self.show_update_banner = true;
    }

    /// Stores release notes for the changelog modal.
    pub fn set_changelog(&mut self, changelog: AppChangelog) {
        self.changelog = Some(changelog);
        self.changelog_markdown_cache = CommonMarkCache::default();
    }

    /// Returns changelog content and markdown cache for rendering.
    pub fn changelog_parts(&mut self) -> Option<(&AppChangelog, &mut CommonMarkCache)> {
        let Self {
            changelog,
            changelog_markdown_cache,
            ..
        } = self;

        changelog
            .as_ref()
            .map(|changelog| (changelog, changelog_markdown_cache))
    }

    /// Clears changelog modal state.
    pub fn clear_changelog(&mut self) {
        self.changelog = None;
        self.changelog_markdown_cache = CommonMarkCache::default();
    }
}
