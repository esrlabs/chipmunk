mod errors;

use std::path::PathBuf;

pub use errors::InitError;
use serde::{Deserialize, Serialize};

use crate::{semantic_version::SemanticVersion, PluginType};

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
    pub fn load() -> Result<Self, InitError> {
        // TODO AAZ: Load from plugins directory.
        Ok(Self {
            plugins: Vec::new(),
        })
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
