//! Module to provide functionality for plugin management including loading, validating and
//! providing plugins state, infos and metadata.

mod errors;
mod load;
#[cfg(test)]
mod tests;

use std::path::{Path, PathBuf};

pub use errors::InitError;
use stypes::{InvalidPluginEntity, PluginEntity};

/// Plugins manager responsible of loading the plugins, providing their states, info and metadata.
#[derive(Debug)]
pub struct PluginsManager {
    installed_plugins: Vec<PluginEntity>,
    invalid_plugins: Vec<InvalidPluginEntity>,
}

impl PluginsManager {
    /// Load plugins from their directory.
    pub async fn load() -> Result<Self, InitError> {
        let (installed_plugins, invalid_plugins) = load::load_all_plugins().await?;

        Ok(Self {
            installed_plugins,
            invalid_plugins,
        })
    }

    /// Provide full infos of all loaded and valid plugins.
    pub fn installed_plugins(&self) -> &[PluginEntity] {
        &self.installed_plugins
    }

    /// Provide directory paths (considered ID) of all loaded and valid plugins.
    pub fn installed_plugins_paths(&self) -> impl Iterator<Item = &PathBuf> {
        self.installed_plugins.iter().map(|p| &p.dir_path)
    }

    /// Provide the info of the plugin with the given [`plugin_dir`] if available.
    ///
    /// * `plugin_dir`: The directory path of the plugin. Considered as ID currently.
    pub fn get_installed_plugin(&self, plugin_dir: &Path) -> Option<&PluginEntity> {
        self.installed_plugins
            .iter()
            .find(|p| p.dir_path == plugin_dir)
    }

    /// Provide all invalid plugins.
    pub fn invalid_plugins(&self) -> &[InvalidPluginEntity] {
        &self.invalid_plugins
    }

    /// Provide directory paths (considered ID) of all invalid plugins.
    pub fn invalid_plugins_paths(&self) -> impl Iterator<Item = &PathBuf> {
        self.invalid_plugins.iter().map(|p| &p.dir_path)
    }

    /// Provide the info of the invalid plugin with the given [`plugin_dir`] if available.
    ///
    /// * `plugin_dir`: The directory path of the plugin. Considered as ID currently.
    pub fn get_invalid_plugin(&self, plugin_dir: &Path) -> Option<&InvalidPluginEntity> {
        self.invalid_plugins
            .iter()
            .find(|p| p.dir_path == plugin_dir)
    }

    /// Reload all the plugins from the plugins directory.
    pub async fn reload(&mut self) -> Result<(), InitError> {
        *self = Self::load().await?;

        Ok(())
    }
}
