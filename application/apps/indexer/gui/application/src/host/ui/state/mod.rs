//! Host-wide state that is not owned by individual tabs.

pub mod info;
pub mod modal;
pub mod plugin;
pub mod preferences;
mod presets;

use crate::host::ui::{
    registry::HostRegistry, shortcuts::state::ShortcutState, state::plugin::PluginsState,
};

use self::{info::AppInfoState, modal::HostModalState};
pub use preferences::HostPreferences;

/// Shared host data used across top-level UI surfaces.
#[derive(Debug, Default)]
pub struct HostState {
    /// Persisted host UI preferences.
    pub preferences: HostPreferences,
    /// Global filters, search values, and presets shared by session UI.
    pub registry: HostRegistry,
    /// Plugin data published by the host service for native UI views.
    pub plugins: PluginsState,
    /// Application version, changelog, and update-banner state.
    pub app_info: AppInfoState,
    /// Keyboard shortcut state for host-level input handling.
    pub shortcuts: ShortcutState,
    /// Tracks the exclusive top-level dialog and pending confirmation answers.
    pub modals: HostModalState,
}
