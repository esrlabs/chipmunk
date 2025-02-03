//! Manages code signing and notarizing across multiple platform when needed.

use std::path::PathBuf;

use anyhow::{bail, ensure, Context};
use macos::MacOsConfig;

mod macos;

#[derive(Debug, Clone)]
/// Manages code signing and notarizing across multiple platform.
pub enum CodeSign {
    MacOs(MacOsConfig),
}

impl CodeSign {
    /// Load and validate the given configurations file, creating [`CodeSign`] instance.
    pub fn load(config_path: PathBuf) -> anyhow::Result<Self> {
        if !cfg!(target_os = "macos") {
            bail!("Code Sign isn't supported on this platform")
        }

        ensure!(
            config_path.exists(),
            "Code-Sign configuration file doesn't exists"
        );

        let config_str = std::fs::read_to_string(config_path)
            .context("Error while reading code sign configuration file")?;
        let mac_config = toml::from_str(&config_str)
            .context("Error while serializing code sign configuration file")?;

        Ok(Self::MacOs(mac_config))
    }

    /// Check if code signing and notarizing is allowed according to the environment variables.
    pub fn allowed(&self) -> bool {
        match self {
            CodeSign::MacOs(config) => macos::allowed(config),
        }
    }

    /// Applies code signing with the given configurations.
    ///
    /// # Panic:
    ///
    /// This function panics if code signing isn't allowed according to environment variables.
    pub fn apply_codesign(&self) -> anyhow::Result<()> {
        assert!(self.allowed(), "Code sign isn't allowed");

        match self {
            CodeSign::MacOs(config) => macos::apply_codesign(config),
        }
    }

    pub fn notarize(&self) -> anyhow::Result<()> {
        assert!(self.allowed(), "Code Notarizing isn't allowed");
        match self {
            CodeSign::MacOs(config) => macos::notarize(config),
        }
    }
}
