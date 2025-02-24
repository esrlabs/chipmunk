//! Module to provide functionality for plugin management including loading, validating and
//! providing plugins state, infos and metadata.

mod errors;
mod load;
#[cfg(test)]
mod tests;

use std::path::{Path, PathBuf};

pub use errors::InitError;
use stypes::{
    ExtendedInvalidPluginEntity, ExtendedPluginEntity, InvalidPluginEntity, PluginEntity,
    PluginRunData,
};

/// Plugins manager responsible of loading the plugins, providing their states, info and metadata.
#[derive(Debug)]
pub struct PluginsManager {
    installed_plugins: Vec<ExtendedPluginEntity>,
    invalid_plugins: Vec<ExtendedInvalidPluginEntity>,
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
    pub fn installed_plugins(&self) -> Vec<&PluginEntity> {
        self.installed_plugins
            .iter()
            .map(|en| en.into())
            .collect::<Vec<&PluginEntity>>()
    }

    /// Provide directory paths (considered ID) of all loaded and valid plugins.
    pub fn installed_plugins_paths(&self) -> impl Iterator<Item = &PathBuf> {
        self.installed_plugins.iter().map(|p| &p.entity.dir_path)
    }

    /// Provide the info of the plugin with the given [`plugin_dir`] if available.
    ///
    /// * `plugin_dir`: The directory path of the plugin. Considered as ID currently.
    pub fn get_installed_plugin(&self, plugin_dir: &Path) -> Option<&PluginEntity> {
        self.installed_plugins.iter().find_map(|p| {
            if p.entity.dir_path == plugin_dir {
                Some(p.into())
            } else {
                None
            }
        })
    }

    /// Provide all invalid plugins.
    pub fn invalid_plugins(&self) -> Vec<&InvalidPluginEntity> {
        self.invalid_plugins
            .iter()
            .map(|en| en.into())
            .collect::<Vec<&InvalidPluginEntity>>()
    }

    /// Provide directory paths (considered ID) of all invalid plugins.
    pub fn invalid_plugins_paths(&self) -> impl Iterator<Item = &PathBuf> {
        self.invalid_plugins.iter().map(|p| &p.entity.dir_path)
    }

    /// Provide the info of the invalid plugin with the given [`plugin_dir`] if available.
    ///
    /// * `plugin_dir`: The directory path of the plugin. Considered as ID currently.
    pub fn get_invalid_plugin(&self, plugin_dir: &Path) -> Option<&InvalidPluginEntity> {
        self.invalid_plugins.iter().find_map(|p| {
            if p.entity.dir_path == plugin_dir {
                Some(p.into())
            } else {
                None
            }
        })
    }

    /// Retrieves runtime data for a plugin located at the specified path.
    ///
    /// This method searches for the plugin's runtime data (`PluginRunData`) among both
    /// successfully loaded plugins and failed ones.
    ///
    /// # Parameters
    /// - `plugin_dir`: The directory path of the plugin.
    ///
    /// # Returns
    /// - `Some(&PluginRunData)`: If the plugin's runtime data is found.
    /// - `None`: If no matching plugin is found.
    pub fn get_plugin_run_data<P: AsRef<Path>>(&self, plugin_dir: P) -> Option<&PluginRunData> {
        self.installed_plugins
            .iter()
            .find_map(|p| {
                if p.entity.dir_path == plugin_dir.as_ref() {
                    Some(&p.run_data)
                } else {
                    None
                }
            })
            .or_else(|| {
                self.invalid_plugins.iter().find_map(|p| {
                    if p.entity.dir_path == plugin_dir.as_ref() {
                        Some(&p.run_data)
                    } else {
                        None
                    }
                })
            })
    }

    /// Reload all the plugins from the plugins directory.
    pub async fn reload(&mut self) -> Result<(), InitError> {
        *self = Self::load().await?;

        Ok(())
    }
}
