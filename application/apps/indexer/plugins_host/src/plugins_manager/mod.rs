mod errors;
mod load;

use std::path::PathBuf;

pub use errors::InitError;
use serde::{Deserialize, Serialize};
use sources::plugins as pl;

use crate::{parser_shared::ParserRenderOptions, semantic_version::SemanticVersion, PluginType};

#[derive(Debug)]
pub struct PluginsManager {
    plugins: Vec<PluginEntity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginEntity {
    pub dir_path: PathBuf,
    pub plugin_type: PluginType,
    pub state: PluginState,
    pub metadata: Option<PluginMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PluginState {
    Active(Box<ValidPluginInfo>),
    Invalid(Box<InvalidPluginInfo>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RenderOptions {
    Parser(Box<ParserRenderOptions>),
    ByteSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidPluginInfo {
    pub wasm_file_path: PathBuf,
    pub api_version: SemanticVersion,
    pub plugin_version: SemanticVersion,
    pub config_schemas: Vec<pl::ConfigSchemaItem>,
    pub render_options: RenderOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvalidPluginInfo {
    pub error_msg: String,
}

impl InvalidPluginInfo {
    pub fn new(error_msg: String) -> Self {
        Self { error_msg }
    }
}

impl PluginsManager {
    pub async fn load() -> Result<Self, InitError> {
        let plugins = load::load_plugins().await?;

        Ok(Self { plugins })
    }

    pub fn all_plugins(&self) -> &[PluginEntity] {
        &self.plugins
    }

    pub fn active_plugins(&self) -> impl Iterator<Item = &PluginEntity> {
        self.plugins.iter().filter(|p| match &p.state {
            PluginState::Active(_) => true,
            PluginState::Invalid(_) => false,
        })
    }

    pub fn invalid_plugins(&self) -> impl Iterator<Item = &PluginEntity> {
        self.plugins.iter().filter(|p| match &p.state {
            PluginState::Active(_) => false,
            PluginState::Invalid(_) => true,
        })
    }

    pub async fn reload(&mut self) -> Result<(), InitError> {
        *self = Self::load().await?;

        Ok(())
    }
}
