use crate::host::ui::update::AppVersionUpdate;

/// UI state for application version information.
#[derive(Debug, Default)]
pub struct AppVersionState {
    /// Newer release information shown to the user when available.
    pub update: Option<AppVersionUpdate>,
}
