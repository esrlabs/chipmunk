use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

use super::utils::get_chipmunk_config;

#[derive(Default, Debug, Deserialize, Serialize)]
pub struct AiConfig {
    pub model: String,
    pub api_key: String,
    pub endpoint: String,
    pub timeout_secs: u64,
}

impl AiConfig {
    pub fn init() -> Self {
        get_chipmunk_config()
            .map(|path| Self::read_settings_from_file(path))
            .unwrap_or_default()
    }

    pub fn new(model: String, api_key: String, endpoint: String, timeout_secs: u64) -> Self {
        AiConfig {
            model,
            api_key,
            endpoint,
            timeout_secs,
        }
    }

    pub fn is_valid(&self) -> bool {
        !self.model.is_empty() && !self.api_key.is_empty() && !self.endpoint.is_empty()
    }

    pub fn save(&self, location: Option<PathBuf>) -> Result<()> {
        let config_path = location
            .or(get_chipmunk_config())
            .context("Could not generate path for saving AI configuration")?;

        if config_path.parent().is_some_and(|p| !p.exists()) {
            std::fs::create_dir_all(&config_path.parent().unwrap())
                .context("Could not create configuration directory")?;
        }

        let str_config = serde_json::to_string_pretty(&self)
            .context("Could not serialize AI configuration to JSON")?;

        std::fs::write(&config_path, str_config).context("Could not write AI configuration to file")
    }

    pub fn read_settings_from_file(path: impl AsRef<Path>) -> Self {
        let str_config = std::fs::read_to_string(&path).unwrap_or_else(|_| String::from("{}"));
        serde_json::from_str(&str_config).unwrap_or_default()
    }
}

#[cfg(test)]
mod test {
    use std::path::PathBuf;

    use super::*;
    use crate::utils::get_chipmunk_config;

    fn create_config_file(config_path: PathBuf) {
        if config_path.parent().is_some_and(|p| !p.exists()) {
            std::fs::create_dir_all(config_path.parent().unwrap())
                .expect("Error while creating the Chipmunk directories for testing");
        }

        let ai_config = AiConfig {
            model: "gpt-4".to_string(),
            api_key: "test_api_key".to_string(),
            endpoint: "https://api.example.com".to_string(),
            timeout_secs: 30,
        };

        let config_str = serde_json::to_string_pretty(&ai_config).unwrap();
        std::fs::write(&config_path, config_str).unwrap();
    }

    #[test]
    fn test_init() {
        let config = AiConfig::init();

        assert_eq!(config.model, "");
        assert_eq!(config.api_key, "");
    }

    #[test]
    fn test_read_settings_from_file() {
        // When config file is not present or path is wrong

        let config = AiConfig::read_settings_from_file("./ai_config.json");

        assert_eq!(config.model, "");
        assert!(!config.is_valid());

        // When config file is present
        let config_file = get_chipmunk_config().unwrap();
        create_config_file(config_file.clone());
        let config = AiConfig::read_settings_from_file(&config_file);

        assert_eq!(config.model, "gpt-4");
        assert!(config.is_valid());

        std::fs::remove_file(config_file)
            .context("Error while removing test config file after reading config")
            .unwrap();
    }

    #[test]
    fn test_save() {
        let config = AiConfig {
            model: "gpt-4".to_string(),
            api_key: String::from("abcd1234"),
            ..Default::default()
        };
        let config_file = get_chipmunk_config().unwrap();
        if config_file.parent().is_some_and(|p| p.exists()) {
            std::fs::create_dir_all(config_file.parent().unwrap())
                .context("Error while creating config directory before saving config")
                .unwrap();
        }
        config
            .save(Some(config_file.clone()))
            .context("Error while saving AI config to default location")
            .unwrap();

        let config_from_file = serde_json::from_str::<AiConfig>(
            std::fs::read_to_string(config_file).unwrap().as_str(),
        )
        .context("Error while reading AI config from file")
        .unwrap();

        assert_eq!("gpt-4", config_from_file.model);
    }
}
