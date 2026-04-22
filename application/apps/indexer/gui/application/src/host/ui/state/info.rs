//! UI state for application metadata and update presentation.

use crate::host::message::AppVersionUpdate;

/// UI state for application information.
#[derive(Debug, Default)]
pub struct AppInfoState {
    update_info: Option<AppVersionUpdate>,
    pub show_update_banner: bool,
    pub about_open: bool,
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
}
