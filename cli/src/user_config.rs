//! Manages loading and providing the user configurations of the Build CLI Tool like the used
//! [`UserShell`] and the preferred [`UiMode`]

use std::{fs::read_to_string, path::PathBuf, sync::OnceLock};

use anyhow::Context;
use serde::{Deserialize, Serialize};

use crate::{cli_args::UiMode, location::build_cli_home_dir, shell::UserShell};

static USER_CONFIGURATION: OnceLock<UserConfiguration> = OnceLock::new();

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
/// Represents the configuration of this tool on the user level, providing settings like
/// [`UserShell`] and [`UiMode`] besides methods to load this configurations from a file.
pub struct UserConfiguration {
    pub shell: UserShell,
    pub ui_mode: UiMode,
}

impl UserConfiguration {
    /// Loads and initializes the user configurations reading from the configuration file when
    /// exists, otherwise loading  the default configurations.
    ///
    /// # Panics
    /// This method can't be called more than once.
    pub fn init() -> anyhow::Result<()> {
        assert!(USER_CONFIGURATION.get().is_none());

        let config = Self::load().context("Error while loading user configuration")?;

        USER_CONFIGURATION
            .set(config)
            .expect("User configuration can't be load more than once");

        Ok(())
    }

    /// Provides a reference to the loaded configuration on the user levels.
    ///
    /// # Panics
    /// This function panics if called before running [`UserConfiguration::init()`].
    pub fn get() -> &'static UserConfiguration {
        USER_CONFIGURATION
            .get()
            .expect("Developer Error: User configuration getter called before initialization")
    }

    /// Provides the path for the configuration file.
    pub fn file_path() -> anyhow::Result<PathBuf> {
        let build_cli_dir =
            build_cli_home_dir().context("Error while resolving build cli home directory")?;

        const USER_CONFIG_FILE_NAME: &str = "config.toml";

        let config_path = build_cli_dir.join(USER_CONFIG_FILE_NAME);

        Ok(config_path)
    }

    /// Loads the configuration from the config file if exists, otherwise it'll provide the default
    /// user configurations
    fn load() -> anyhow::Result<UserConfiguration> {
        let config_file = Self::file_path()?;
        if !config_file.exists() {
            return Ok(UserConfiguration::default());
        }

        let config_content = read_to_string(&config_file).with_context(|| {
            format!(
                "Error while reading user config file content. Path: {}",
                config_file.display()
            )
        })?;

        let config = toml::from_str(&config_content).with_context(|| {
            format!(
                "Error while parsing user configuration file. Path: {}",
                config_file.display()
            )
        })?;

        Ok(config)
    }
}
