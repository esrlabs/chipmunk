//! UI-owned plugin manager state for the native host.
//!
//! The host service publishes this state as plugin loading and operations progress.

use std::{collections::HashMap, path::PathBuf};

use log::trace;
use stypes::{InvalidPluginEntity, PluginEntity, PluginRunData};

/// Plugin manager state visible to host UI components.
#[derive(Debug, Clone, Default)]
pub enum PluginsState {
    /// Plugin manager loading is in progress.
    #[default]
    Loading,
    /// Plugin manager failed to load and is not currently available.
    Unavailable,
    /// Plugin manager is available and has published plugin data.
    Available(PluginsData),
}

impl PluginsState {
    /// Replaces the current plugin state and logs a compact transition summary.
    pub fn set(&mut self, state: Self) {
        //TODO AAZ: Remove debug print.
        dbg!(&state);

        match &state {
            Self::Loading => trace!("Plugin state changed: loading"),
            Self::Unavailable => trace!("Plugin state changed: unavailable"),
            Self::Available(data) => trace!(
                "Plugin state changed: available. installed={}, invalid={}, run_data={}",
                data.installed.len(),
                data.invalid.len(),
                data.run_data.len()
            ),
        }

        *self = state;
    }
}

/// Plugin registry data available when the plugin manager is loaded.
#[derive(Debug, Clone, Default)]
pub struct PluginsData {
    /// Valid plugins loaded by the backend plugin manager.
    pub installed: Vec<PluginEntity>,
    /// Plugin directories found by the backend but rejected during loading or validation.
    pub invalid: Vec<InvalidPluginEntity>,
    /// Runtime load logs and diagnostics keyed by plugin directory path.
    pub run_data: HashMap<PathBuf, PluginRunData>,
}
