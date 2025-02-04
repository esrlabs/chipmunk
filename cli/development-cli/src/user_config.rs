//! Manages loading and providing the user configurations of the Build CLI Tool like the used
//! [`UserShell`] and the preferred [`UiMode`]

use std::{fs::read_to_string, path::PathBuf, sync::OnceLock};

use anyhow::{ensure, Context};
use console::style;
use serde::{Deserialize, Serialize};

use crate::{
    cli_args::UiMode, jobs_runner::additional_features::AdditionalFeatures,
    location::build_cli_home_dir, shell::UserShell,
};

static USER_CONFIGURATION: OnceLock<UserConfiguration> = OnceLock::new();

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
/// Represents the configuration of this tool on the user level, providing settings like
/// [`UserShell`], [`UiMode`] and [`AdditionalFeatures`] besides methods to load this
/// configurations from a file.
pub struct UserConfiguration {
    #[serde(default)]
    pub shell: UserShell,
    #[serde(default)]
    pub ui_mode: UiMode,
    #[serde(default)]
    pub additional_features: Vec<AdditionalFeatures>,
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

        config
            .validate()
            .context("Validation of user configuration failed")?;

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

    /// Serializes the default configurations to `toml` pretty format.
    fn default_serialized() -> anyhow::Result<String> {
        let config = Self::default();
        let config_print = toml::to_string_pretty(&config)
            .context("Error while serializing user configurations to toml format")?;

        Ok(config_print)
    }

    /// Prints the default configurations in to `stdout` in `toml` format, to be used as a
    /// reference in creating configuration files
    pub fn print_default() -> anyhow::Result<()> {
        let config_print = Self::default_serialized()?;

        println!("{config_print}");

        Ok(())
    }

    /// Writes the default configurations to the configuration file if it doesn't exit, creating
    /// all the directories to the file path if needed.
    ///
    /// # Errors
    /// This function errors if the file already exists, besides other IO and serialization errors.
    pub fn write_default_to_file() -> anyhow::Result<()> {
        let file_path =
            Self::file_path().context("Error while resolving user configuration file")?;

        ensure!(
            !file_path.exists(),
            "Abort because configuration file already exists. Path: {}",
            file_path.display()
        );

        let config_serialized = Self::default_serialized()?;

        // Create directories if needed.
        let parent_dir = file_path
            .parent()
            .expect("User config path always has parent directory");
        if !parent_dir.exists() {
            std::fs::create_dir_all(parent_dir).with_context(|| {
                format!("Error while creating directory: {}", parent_dir.display())
            })?;
        }

        std::fs::write(&file_path, config_serialized.as_bytes()).with_context(|| {
            format!(
                "Error while writing user configuration for file. Path: {}",
                file_path.display()
            )
        })?;

        println!(
            "{}",
            style("Default user configuration written to file successfully").green()
        );
        println!("Config file path: {}", file_path.display());

        Ok(())
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

    fn validate(&self) -> anyhow::Result<()> {
        ensure!(
            self.shell.exist(),
            "Configured shell doesn't exist on the system. Shell: {}, Shell binary name: {}\n\
             Please check your configuration file in: {}",
            self.shell,
            self.shell.bin(),
            Self::file_path().unwrap_or_default().display()
        );

        Ok(())
    }
}
