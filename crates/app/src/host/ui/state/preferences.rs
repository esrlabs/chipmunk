//! Persisted host UI preferences.

use serde::{Deserialize, Serialize};

/// Host UI preferences stored through eframe persistence.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct HostPreferences {
    /// Shared visibility for the host right panel and session auxiliary panels.
    pub panels_visibility: PanelsVisibility,
    /// Controls the session stream input bar visibility.
    #[serde(default = "stream_input_visible_default")]
    pub sde_bar_visible: bool,
}

impl Default for HostPreferences {
    fn default() -> Self {
        Self {
            panels_visibility: PanelsVisibility::default(),
            sde_bar_visible: stream_input_visible_default(),
        }
    }
}

/// Shared visibility state for the host right panel and session auxiliary panels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct PanelsVisibility {
    /// Controls the right-side panel visibility in home and session views.
    #[serde(default = "panel_visible_default")]
    pub right: bool,
    /// Controls the session bottom panel visibility.
    #[serde(default = "panel_visible_default")]
    pub bottom: bool,
}

impl Default for PanelsVisibility {
    fn default() -> Self {
        Self {
            right: true,
            bottom: true,
        }
    }
}

fn panel_visible_default() -> bool {
    true
}

fn stream_input_visible_default() -> bool {
    true
}
