//! Module to provide functionality for plugin management including loading, validating and
//! providing plugins state, infos and metadata.

mod errors;
mod load;

pub use errors::InitError;
use stypes::{PluginEntity, PluginState};

/// Plugins manager responsible of loading the plugins, providing their states, info and metadata.
#[derive(Debug)]
pub struct PluginsManager {
    plugins: Vec<PluginEntity>,
}

impl PluginsManager {
    /// Load plugins from their directory.
    pub async fn load() -> Result<Self, InitError> {
        let plugins = load::load_plugins().await?;

        Ok(Self { plugins })
    }

    /// Provide all loaded plugins with all states (Valid and invalid)
    pub fn all_plugins(&self) -> &[PluginEntity] {
        &self.plugins
    }

    /// Provide all loaded plugins that are valid.
    pub fn active_plugins(&self) -> impl Iterator<Item = &PluginEntity> {
        self.plugins.iter().filter(|p| match &p.state {
            PluginState::Active(_) => true,
            PluginState::Invalid(_) => false,
        })
    }

    /// Reload all the plugins from the plugins directory.
    pub async fn reload(&mut self) -> Result<(), InitError> {
        *self = Self::load().await?;

        Ok(())
    }
}
