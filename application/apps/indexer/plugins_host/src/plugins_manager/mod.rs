mod errors;
mod load;

pub use errors::InitError;
use stypes::{PluginEntity, PluginState};

#[derive(Debug)]
pub struct PluginsManager {
    plugins: Vec<PluginEntity>,
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
