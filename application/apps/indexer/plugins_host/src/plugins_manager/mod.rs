mod errors;

use std::{
    path::PathBuf,
    sync::{OnceLock, RwLock},
};

pub use errors::InitError;
use serde::{Deserialize, Serialize};

use crate::{semantic_version::SemanticVersion, PluginType};

static PLUGINS_MANAGER: OnceLock<RwLock<PluginsManager>> = OnceLock::new();

#[derive(Debug)]
pub struct PluginsManager {
    plugins: Vec<PluginEntity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginEntity {
    pub dir_path: PathBuf,
    pub wasm_file_path: PathBuf,
    pub plugin_type: PluginType,
    pub state: PluginState,
    pub metadata: Option<PluginMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub name: String,
    pub description: Option<String>,
    pub version: Option<SemanticVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PluginState {
    Active,
    Invalid(String),
}

impl PluginsManager {
    pub fn init() -> Result<(), InitError> {
        let manager = PluginsManager::load()?;
        assert!(
            PLUGINS_MANAGER.set(RwLock::new(manager)).is_ok(),
            "Plugin manager can't be initialized more than once"
        );

        Ok(())
    }

    fn load() -> Result<Self, InitError> {
        // TODO AAZ: Load from plugins directory.
        Ok(Self {
            plugins: Vec::new(),
        })
    }

    pub fn get() -> &'static RwLock<Self> {
        PLUGINS_MANAGER
            .get()
            .expect("Plugin manager can't be used before initialization")
    }

    pub fn all_plugins(&self) -> &[PluginEntity] {
        &self.plugins
    }

    pub fn active_plugins(&self) -> impl Iterator<Item = &PluginEntity> {
        self.plugins.iter().filter(|p| match &p.state {
            PluginState::Active => true,
            PluginState::Invalid(_) => false,
        })
    }

    pub fn invalid_plugins(&self) -> impl Iterator<Item = &PluginEntity> {
        self.plugins.iter().filter(|p| match &p.state {
            PluginState::Active => false,
            PluginState::Invalid(_) => true,
        })
    }

    pub fn reload(&mut self) -> Result<(), InitError> {
        *self = Self::load()?;

        Ok(())
    }
}
