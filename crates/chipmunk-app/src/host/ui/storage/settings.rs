//! Application settings stored through the host storage service.

use serde::{Deserialize, Serialize};

/// Persistent application settings.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    /// Update-check settings.
    pub updates: UpdateSettings,
}

/// UI-side storage state for application settings.
#[derive(Debug)]
pub struct AppSettingsStorage {
    settings: AppSettings,
    dirty: bool,
}

/// Persistent settings for application update checks.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct UpdateSettings {
    /// Whether the application should check for updates on startup.
    pub check_for_updates: bool,
    /// Whether pre-release versions should be considered during update checks.
    pub check_pre_releases: bool,
}

impl AppSettingsStorage {
    pub fn new(settings: AppSettings) -> Self {
        Self {
            settings,
            dirty: false,
        }
    }

    pub fn current(&self) -> &AppSettings {
        &self.settings
    }

    pub fn apply(&mut self, settings: AppSettings) {
        if self.settings == settings {
            return;
        }

        self.settings = settings;
        self.dirty = true;
    }

    pub fn get_save_data(&mut self) -> Option<AppSettings> {
        if !self.dirty {
            return None;
        }

        self.dirty = false;
        Some(self.settings.clone())
    }

    /// Marks the current settings for retry after a failed aggregate save.
    pub fn mark_dirty(&mut self) {
        self.dirty = true;
    }
}

impl Default for UpdateSettings {
    fn default() -> Self {
        Self {
            check_for_updates: true,
            check_pre_releases: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateSettings;

    #[test]
    fn update_settings_defaults_enable_stable_update_checks() {
        assert_eq!(
            UpdateSettings::default(),
            UpdateSettings {
                check_for_updates: true,
                check_pre_releases: false,
            }
        );
    }
}
