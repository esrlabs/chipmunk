//! UI state for application metadata and update presentation.

use egui::{Context, ViewportCommand};
use egui_commonmark::CommonMarkCache;

use crate::host::{
    notification::AppNotification,
    ui::{
        actions::UiActions,
        update::{AppChangelog, AppVersionUpdate, DownloadedUpdate, UpdateCheckResult},
    },
};

/// UI state for application information.
#[derive(Debug, Default)]
pub struct AppInfoState {
    update_info: Option<AppVersionUpdate>,
    downloaded_update: Option<DownloadedUpdate>,
    update_running: bool,
    update_check_running: bool,
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
        self.downloaded_update = None;
        self.update_running = false;
        self.show_update_banner = true;
    }

    /// Starts a user-triggered update check if none is already running.
    ///
    /// Returns `true` when a new check was started and `false` when another check is still running.
    pub fn begin_update_check(&mut self) -> bool {
        if self.update_check_running {
            return false;
        }

        self.update_check_running = true;
        true
    }

    /// Returns whether a user-triggered update check is currently running.
    pub fn is_checking_updates(&self) -> bool {
        self.update_check_running
    }

    /// Cancels user-triggered update-check state after the request could not be sent.
    pub fn cancel_update_check(&mut self) {
        self.update_check_running = false;
    }

    /// Handles a completed user-triggered update check.
    pub fn handle_update_check(&mut self, result: UpdateCheckResult, ui_actions: &mut UiActions) {
        self.update_check_running = false;

        match result {
            UpdateCheckResult::UpdateAvailable(update_info) => self.set_update_info(update_info),
            UpdateCheckResult::UpToDate => {
                ui_actions.add_notification(AppNotification::Info("Chipmunk is up to date.".into()))
            }
            UpdateCheckResult::Failed(err) => {
                ui_actions.add_notification(AppNotification::Error(err));
            }
        }
    }

    /// Handles a completed app update download request.
    pub fn handle_update_download(
        &mut self,
        result: Result<DownloadedUpdate, String>,
        ui_actions: &mut UiActions,
    ) {
        match result {
            Ok(downloaded_update) => {
                self.downloaded_update = Some(downloaded_update);
                self.update_running = false;
                ui_actions.add_notification(AppNotification::Info(
                    "Update downloaded. It will be installed when Chipmunk closes.".into(),
                ));
            }
            Err(err) => {
                self.update_running = false;
                ui_actions.add_notification(AppNotification::Error(err));
            }
        }
    }

    /// Starts install-on-exit work for a downloaded update if one is ready.
    pub fn begin_update_install(&mut self) -> Option<DownloadedUpdate> {
        if self.update_running {
            return None;
        }

        let downloaded_update = self.downloaded_update.as_ref()?;
        self.update_running = true;
        Some(downloaded_update.to_owned())
    }

    /// Returns whether update install-on-exit work is currently running.
    pub fn is_update_running(&self) -> bool {
        self.update_running
    }

    /// Cancels update install-on-exit state after the request could not be sent.
    pub fn cancel_update_install(&mut self) {
        self.update_running = false;
        self.downloaded_update = None;
    }

    /// Handles update install-on-exit completion.
    pub fn handle_update_install(
        &mut self,
        result: Result<(), String>,
        ui_actions: &mut UiActions,
        ctx: &Context,
    ) {
        self.update_running = false;
        self.downloaded_update = None;

        match result {
            Ok(()) => ctx.send_viewport_cmd(ViewportCommand::Close),
            Err(err) => ui_actions.add_notification(AppNotification::Error(err)),
        }
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
