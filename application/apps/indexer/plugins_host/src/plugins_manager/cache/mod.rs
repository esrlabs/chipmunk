//! Module to handle caching the plugin infos to avoid loading the plugin on each start
//! of the app.
//! The Hash of the plugin wasm file is used to detect changes to reload the file and
//! update the cache.
use std::{
    fs::File,
    io::Write,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use stypes::PluginInfo;

use crate::plugins_manager::paths::extract_plugin_file_paths;

use super::{PluginsCacheError, paths::plugins_dir};

pub const CACHE_FILENAME: &str = ".cache";

/// Manages caching the infos of the plugins while keeping track on plugin to detect
/// changes on the plugin wasm file by comparing their hashes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheManager {
    plugins_info: Vec<PluginCacheInfo>,
    #[serde(skip)]
    hasher: blake3::Hasher,
}

impl Default for CacheManager {
    fn default() -> Self {
        Self {
            hasher: blake3::Hasher::new(),
            plugins_info: Vec::new(),
        }
    }
}

impl CacheManager {
    /// Loads the cache from the cache file if it exists; otherwise, creates an empty cache.
    pub fn load() -> Result<Self, PluginsCacheError> {
        let cache_path = Self::cache_file_path()?;

        if !cache_path.exists() {
            return Ok(Self::default());
        }

        let cache_file = File::open(cache_path)?;

        serde_json::from_reader(cache_file).map_err(|err| err.into())
    }

    fn cache_file_path() -> Result<PathBuf, PluginsCacheError> {
        plugins_dir()
            .map(|dir| dir.join(CACHE_FILENAME))
            .ok_or_else(|| PluginsCacheError::Other("Failed to find home directory".into()))
    }

    /// Provide the plugin state from cache for the given plugin if exists.
    pub fn get_plugin_cache(
        &self,
        plug_dir: &Path,
    ) -> Result<Option<CachedPluginState>, PluginsCacheError> {
        let Some(plug_cach_info) = self
            .plugins_info
            .iter()
            .find(|plug| plug.plugin_dir == plug_dir)
        else {
            return Ok(None);
        };

        let calculated_hash = self.calc_plugin_hash(plug_dir)?;

        if plug_cach_info.file_hash == calculated_hash {
            Ok(Some(plug_cach_info.state.to_owned()))
        } else {
            Ok(None)
        }
    }

    /// Calculates the hash of the plugin wasm file in the provided `plugin_dir`.
    fn calc_plugin_hash(&self, plugin_dir: &Path) -> Result<String, PluginsCacheError> {
        let plugin_files = extract_plugin_file_paths(plugin_dir).ok_or_else(|| {
            PluginsCacheError::Other(format!(
                "Extracting plugins files from its directory failed. Plugin directory: {}",
                plugin_dir.display()
            ))
        })?;

        let wasm_file = plugin_files.wasm_file;
        if !wasm_file.exists() {
            return Err(std::io::Error::other("Plugin wasm file not found").into());
        }

        let file_hash = dir_checksum::calc_file_hash(&wasm_file, &self.hasher)?;

        Ok(file_hash.to_string())
    }

    /// Updates the plugins info and hash if exists or creates a new one if not, with
    /// the option to persist the cache to the file.
    pub fn update_plugin(
        &mut self,
        plug_dir: &Path,
        state: CachedPluginState,
    ) -> Result<(), PluginsCacheError> {
        let calculated_hash = self.calc_plugin_hash(plug_dir)?;

        match self
            .plugins_info
            .iter_mut()
            .find(|plug| plug.plugin_dir == plug_dir)
        {
            Some(plug_info) => {
                plug_info.file_hash = calculated_hash;
                plug_info.state = state;
            }
            None => {
                let plug_info = PluginCacheInfo::new(plug_dir.into(), calculated_hash, state);
                self.plugins_info.push(plug_info);
            }
        };

        Ok(())
    }

    /// Writes the caches infos into the cache file to be read from in future sessions.
    pub fn persist(&self) -> Result<(), PluginsCacheError> {
        let cache_path = Self::cache_file_path()?;
        let cache_parent = cache_path
            .parent()
            .expect("Cache file is inside plugins directory");
        if !cache_parent.exists() {
            std::fs::create_dir_all(cache_parent)?;
        }

        let mut file = File::create(cache_path)?;
        let cached_json = serde_json::to_string_pretty(self)?;
        file.write_all(cached_json.as_bytes())?;

        Ok(())
    }

    /// Remove plugin from cache registry of exists with the option to persist the current cache.
    pub fn remove_plugin(
        &mut self,
        plugin_dir: &Path,
        persist: bool,
    ) -> Result<(), PluginsCacheError> {
        let Some(plugin_idx) = self
            .plugins_info
            .iter()
            .position(|plug| plug.plugin_dir == plugin_dir)
        else {
            return Ok(());
        };

        let _ = self.plugins_info.remove(plugin_idx);

        if persist {
            self.persist()?;
        }

        Ok(())
    }

    /// Empties cached data and removes cache file if exist.
    pub fn reset(&mut self) -> Result<(), PluginsCacheError> {
        let cache_path = Self::cache_file_path()?;
        if cache_path.exists() {
            std::fs::remove_file(cache_path)?;
        }

        let Self {
            plugins_info,
            hasher: _,
        } = self;

        plugins_info.clear();

        Ok(())
    }
}

/// Represents the state of a plugin inside the cache.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CachedPluginState {
    /// Plugin is installed (valid) with its infos.
    Installed(PluginInfo),
    /// Plugin is invalid with its error message.
    Invalid(String),
}

/// Represents the info of a valid plugin inside the cache.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCacheInfo {
    /// Path of plugins directory (Used as identifier)
    plugin_dir: PathBuf,
    /// The hash of the plugin `WASM` file.
    file_hash: String,
    /// Cached plugin state and infos.
    pub state: CachedPluginState,
}

impl PluginCacheInfo {
    /// Creates a new instance with the given arguments.
    ///
    /// * `plugin_dir`: Path of plugins directory (Used as identifier)
    /// * `file_hash`: The hash of the plugin `WASM` file.
    /// * `state`: Cached plugin state and infos.
    pub fn new(plugin_dir: PathBuf, file_hash: String, state: CachedPluginState) -> Self {
        Self {
            plugin_dir,
            file_hash,
            state,
        }
    }
}
