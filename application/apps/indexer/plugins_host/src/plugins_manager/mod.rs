//! Module to provide functionality for plugin management including loading, validating and
//! providing plugins state, infos and metadata.

mod cache;
mod errors;
mod load;
pub mod paths;
#[cfg(test)]
mod tests;

use std::path::{Path, PathBuf};

use crate::plugins_shared::load::{load_and_inspect, WasmComponentInfo};
use cache::CacheManager;
use load::{load_plugin, validate_plugin_files, PluginEntityState, PluginFilesStatus};
use paths::extract_plugin_file_paths;
use stypes::{
    ExtendedInvalidPluginEntity, ExtendedPluginEntity, InvalidPluginEntity, PluginEntity,
    PluginLogLevel, PluginRunData, PluginType,
};

pub use errors::{PluginsCacheError, PluginsManagerError};

/// Plugins manager responsible of loading the plugins, providing their states, info and metadata.
#[derive(Debug)]
pub struct PluginsManager {
    cache_manager: CacheManager,
    installed_plugins: Vec<ExtendedPluginEntity>,
    invalid_plugins: Vec<ExtendedInvalidPluginEntity>,
}

impl PluginsManager {
    /// Load plugins from their directory.
    pub async fn load() -> Result<Self, PluginsManagerError> {
        let mut cache_manager = match CacheManager::load() {
            Ok(manager) => manager,
            Err(err) => {
                // Don't stop the whole plugins manager when cache loading fails.
                let err_msg = format!("Loading cached plugins failed with the error: {err}");

                log::warn!("{err_msg}");

                // Print error to stderr in development with red error.
                if cfg!(debug_assertions) {
                    eprintln!("\x1b[31mError:\x1b[0m {err_msg}");
                }

                CacheManager::default()
            }
        };

        let (installed_plugins, invalid_plugins) =
            load::load_all_plugins(&mut cache_manager).await?;

        // Loading the plugins will update cache manager but won't persist this changes.
        cache_manager.persist()?;

        Ok(Self {
            cache_manager,
            installed_plugins,
            invalid_plugins,
        })
    }

    /// Provide full infos of all loaded and valid plugins.
    pub fn installed_plugins(&self) -> impl Iterator<Item = &PluginEntity> {
        self.installed_plugins.iter().map(|en| en.into())
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
    pub fn invalid_plugins(&self) -> impl Iterator<Item = &InvalidPluginEntity> {
        self.invalid_plugins.iter().map(|en| en.into())
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
    pub async fn reload(&mut self) -> Result<(), PluginsManagerError> {
        let Self {
            cache_manager,
            installed_plugins,
            invalid_plugins,
        } = self;

        cache_manager.reset()?;

        let (installed, invalid) = load::load_all_plugins(cache_manager).await?;
        *installed_plugins = installed;
        *invalid_plugins = invalid;

        // Loading the plugins will update cache manager but won't persist this changes.
        cache_manager.persist()?;

        Ok(())
    }

    /// Adds a plugin with the given directory path and the optional plugin type.
    ///
    /// * `plugin_dir_src`: Path of the plugin directory to be copied into chipmunk plugins directory.
    /// * `plugin_type`: Type of the plugin, when not provided plugin type will be entered from plugin
    ///   `WIT` signature in its binary file.
    pub async fn add_plugin(
        &mut self,
        plugin_dir_src: PathBuf,
        plugin_type: Option<PluginType>,
    ) -> Result<(), PluginsManagerError> {
        if !plugin_dir_src.is_dir() {
            let err_msg = format!(
                "Plugin directory isn't a directory. Path: {}",
                plugin_dir_src.display()
            );

            return Err(PluginsManagerError::Other(err_msg));
        }

        let plugin_name = paths::get_plugin_name(&plugin_dir_src).ok_or_else(|| {
            PluginsManagerError::Other(format!(
                "Extracting plugin name failed. Path: {}",
                plugin_dir_src.display()
            ))
        })?;

        let (wasm_path_src, metadata_path_src, readme_path_src) =
            match validate_plugin_files(&plugin_dir_src)? {
                PluginFilesStatus::Valid {
                    wasm_path,
                    metadata_file,
                    readme_file,
                } => (wasm_path, metadata_file, readme_file),
                PluginFilesStatus::Invalid { err_msg } => {
                    return Err(PluginsManagerError::Other(format!(
                        "Plugin files are invalid: Error: {err_msg}"
                    )));
                }
            };

        // Retrieve plugin type from its binary if not provided.
        let plugin_type = if let Some(plug_type) = plugin_type {
            plug_type
        } else {
            let WasmComponentInfo { plugin_type, .. } = load_and_inspect(&wasm_path_src).await?;
            plugin_type
        };

        // Check if the plugin already exist in the valid plugins.
        // If plugin existed and invalid then we can replace it.
        if self
            .installed_plugins
            .iter()
            .filter(|plug| plug.entity.plugin_type == plugin_type)
            .any(|plug| {
                paths::get_plugin_name(&plug.entity.dir_path)
                    .is_some_and(|name| name == plugin_name)
            })
        {
            let err_msg =
                format!("Installed plugin with the same name already exist. Name: '{plugin_name}'");
            return Err(PluginsManagerError::Other(err_msg));
        }

        // Copy plugin relevant files to plugin dist directory, removing it if exists.
        let plugin_dir_dist = plugin_root_dir(plugin_type)?.join(plugin_name);
        if plugin_dir_dist.exists() {
            std::fs::remove_dir_all(&plugin_dir_dist)?;
        }
        std::fs::create_dir_all(&plugin_dir_dist)?;

        let dist_paths = extract_plugin_file_paths(&plugin_dir_dist)
            .ok_or_else(|| PluginsManagerError::Other("Failed to extract plugin files".into()))?;

        tokio::fs::copy(&wasm_path_src, &dist_paths.wasm_file).await?;

        if let Some(meta_src) = &metadata_path_src {
            tokio::fs::copy(meta_src, &dist_paths.metadata_file).await?;
        }

        if let Some(readme_src) = &readme_path_src {
            tokio::fs::copy(readme_src, &dist_paths.readme_file).await?;
        }

        // Load plugin form its directory after copying.
        let plugin_entity =
            match load_plugin(plugin_dir_dist, plugin_type, &mut self.cache_manager).await? {
                PluginEntityState::Valid(plugin_entity) => plugin_entity,
                PluginEntityState::Invalid(invalid_entity) => {
                    use std::fmt::Write;
                    let mut err_msg = String::from("Invalid Plugin. Logs:\n");
                    invalid_entity
                        .run_data
                        .logs
                        .into_iter()
                        .filter(|msg| match msg.level {
                            PluginLogLevel::Err | PluginLogLevel::Warn => true,
                            PluginLogLevel::Debug | PluginLogLevel::Info => false,
                        })
                        .for_each(|msg| {
                            // Writing to a string never fails.
                            _ = writeln!(&mut err_msg, "{}", msg.msg);
                        });

                    return Err(PluginsManagerError::Other(err_msg));
                }
            };

        self.installed_plugins.push(plugin_entity);

        // Loading will update the cache manager but won't persist it.
        self.cache_manager.persist()?;

        Ok(())
    }

    pub async fn remove_plugin(&mut self, plugin_dir: &Path) -> Result<(), PluginsManagerError> {
        if !plugin_dir.is_dir() {
            let err_msg = format!(
                "Plugin directory isn't a directory. Path: {}",
                plugin_dir.display()
            );

            return Err(PluginsManagerError::Other(err_msg));
        }

        if let Some(plug_idx) = self
            .installed_plugins
            .iter()
            .position(|plug| plug.entity.dir_path == plugin_dir)
        {
            let _ = self.installed_plugins.remove(plug_idx);
        } else if let Some(invalid_plug_idx) = self
            .invalid_plugins
            .iter()
            .position(|plug| plug.entity.dir_path == plugin_dir)
        {
            let _ = self.invalid_plugins.remove(invalid_plug_idx);
        } else {
            let err_msg = format!(
                "Plugin can't be found in registry. Plugin directory path: {}",
                plugin_dir.display()
            );

            return Err(PluginsManagerError::Other(err_msg));
        }

        std::fs::remove_dir_all(plugin_dir)?;
        self.cache_manager.remove_plugin(plugin_dir, true)?;

        Ok(())
    }
}

/// Provides the root path of the plugins directory for the provided plugin type.
fn plugin_root_dir(plug_type: PluginType) -> Result<PathBuf, PluginsManagerError> {
    let plugins_dir = match plug_type {
        PluginType::Parser => paths::parser_dir(),
        PluginType::ByteSource => paths::bytesource_dir(),
        PluginType::Producer => paths::producer_dir(),
    };
    plugins_dir
        .ok_or_else(|| PluginsManagerError::Other(String::from("Failed to find home directory")))
}
