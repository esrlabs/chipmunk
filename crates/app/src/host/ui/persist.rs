//! Lightweight host UI persistence stored through eframe.
//!
//! Use this module for small UI preferences and presentation state that belongs
//! to the host UI, such as panel visibility. Heavier app-domain state that affects
//! application behavior should live in `storage` and be saved through the host service.

use eframe::{Storage, get_value, set_value};

use super::{Host, state::HostPreferences};

const HOST_PREFERENCES_KEY: &str = "chipmunk.host_preferences";

/// Loads persisted host UI preferences into the application.
pub fn load(storage: Option<&dyn Storage>, host: &mut Host) {
    if let Some(preferences) = storage.and_then(load_preferences) {
        host.state.preferences = preferences;
    }
}

/// Saves host UI preferences into eframe storage.
pub fn save(storage: &mut dyn Storage, host: &mut Host) {
    set_value(storage, HOST_PREFERENCES_KEY, &host.state.preferences);
}

fn load_preferences(storage: &dyn Storage) -> Option<HostPreferences> {
    get_value(storage, HOST_PREFERENCES_KEY)
}
