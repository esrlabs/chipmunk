//! Host update workflow types and UI orchestration.

use std::path::PathBuf;

use egui::{Ui, ViewportCommand};
use semver::Version;

use crate::{common::ui::modal::show_busy_indicator, host::command::HostCommand};

use super::{Host, state::modal::HostModal};

/// Message payload for a newer application version.
#[derive(Debug)]
pub struct AppVersionUpdate {
    /// Newer version returned by the release source.
    pub latest_version: Version,
    /// Release page URL.
    pub release_url: String,
    /// Selected automatic update plan, when one is safe for this installation.
    pub plan: Option<UpdatePlan>,
}

/// Message payload for release notes shown after an application update.
#[derive(Debug)]
pub struct AppChangelog {
    /// Version whose release notes are being shown.
    pub version: Version,
    /// Markdown release notes.
    pub release_notes: String,
    /// Release page URL.
    pub release_url: String,
}

/// Parameters for downloading a selected app update artifact.
#[derive(Debug, Clone)]
pub struct DownloadUpdateParam {
    /// Version selected by release lookup.
    pub latest_version: Version,
    /// GitHub release page URL.
    pub release_url: String,
    /// Selected workflow and artifact to download.
    pub plan: UpdatePlan,
}

/// Downloaded update ready for install-on-exit orchestration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DownloadedUpdate {
    /// Version selected by release lookup.
    pub latest_version: Version,
    /// GitHub release page URL.
    pub release_url: String,
    /// Selected workflow and artifact downloaded for the update.
    pub plan: UpdatePlan,
    /// Downloaded release artifact path.
    pub artifact_path: PathBuf,
}

/// Automatic update plan selected for a release.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdatePlan {
    /// Install workflow selected for the current installation.
    pub workflow: UpdateWorkflow,
    /// Release asset the app can download for the selected workflow.
    pub artifact: UpdateArtifact,
}

/// Release asset the app can download for a built-in update.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateArtifact {
    /// GitHub release asset name.
    pub name: String,
    /// Direct GitHub asset download URL.
    pub download_url: String,
}

/// Update workflow selected for the current installation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UpdateWorkflow {
    /// Archive replacement in the resolved installation directory.
    Archive {
        /// Directory containing the files to replace from a portable archive.
        install_dir: PathBuf,
    },
    /// Debian package update.
    Deb,
    /// RPM package update.
    Rpm,
    /// Windows MSI installer update.
    Msi,
    /// macOS PKG installer update.
    Pkg,
}

impl Host {
    /// Handles app changelog metadata from the host service.
    pub fn handle_update_changelog(&mut self, changelog: AppChangelog) {
        if self.state.modals.open(HostModal::Changelog) {
            self.state.app_info.set_changelog(changelog);
        }
    }

    /// Renders update workflow busy UI when needed.
    pub fn render_update_busy(&mut self, ui: &Ui) {
        if self.state.app_info.is_update_running() {
            show_busy_indicator(ui, Some("Installing update..."), Option::<fn()>::None);
        }
    }

    /// Handles update workflow close preflight after a close request.
    pub fn handle_update_close_requested(&mut self, ui: &mut Ui) {
        if self.state.app_info.is_update_running() {
            ui.send_viewport_cmd(ViewportCommand::CancelClose);
            return;
        }

        let Some(downloaded_update) = self.state.app_info.begin_update_install() else {
            return;
        };

        ui.send_viewport_cmd(ViewportCommand::CancelClose);
        let command = HostCommand::InstallAppUpdate(Box::new(downloaded_update));
        if !self
            .ui_actions
            .try_send_command(&self.senders.cmd_tx, command)
        {
            self.state.app_info.cancel_update_install();
        }
    }
}
