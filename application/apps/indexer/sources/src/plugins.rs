use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginParserSettings {
    pub plugin_path: PathBuf,
    //TODO AAZ: Temp solution.
    //Check if Default implementation should be removed on General Setting once this temp is done.
    #[serde(default)]
    pub general_settings: PluginParserGeneralSettings,
    pub plugin_configs: Vec<ConfigItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
/// General settings for all parsers as plugins
pub struct PluginParserGeneralSettings {
    pub placeholder: String,
}

impl PluginParserSettings {
    /// Implementation needed during prototyping only
    pub fn prototyping(plugin_path: PathBuf, plugin_configs: Vec<ConfigItem>) -> Self {
        Self {
            plugin_path,
            general_settings: PluginParserGeneralSettings {
                placeholder: Default::default(),
            },
            plugin_configs,
        }
    }

    /// Default implementation needed during prototyping only
    pub fn default_prototyping() -> Self {
        Self::prototyping(PathBuf::default(), Vec::new())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginByteSourceSettings {
    pub plugin_path: PathBuf,
    pub general_settings: PluginByteSourceGeneralSettings,
    pub plugin_configs: Vec<ConfigItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
/// General settings for all parsers as plugins
pub struct PluginByteSourceGeneralSettings {
    pub placeholder: String,
}

impl PluginByteSourceSettings {
    /// Implementation needed during prototyping only
    pub fn prototyping(plugin_path: PathBuf, plugin_configs: Vec<ConfigItem>) -> Self {
        Self {
            plugin_path,
            general_settings: PluginByteSourceGeneralSettings {
                placeholder: Default::default(),
            },
            plugin_configs,
        }
    }
}

/// Defines the possible input types for configuration schemas.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConfigSchemaType {
    Boolean,
    Number,
    Float,
    Text,
    Path,
    /// Drop-down input type with a list of selectable options.
    Dropdown(Vec<String>),
}

/// Represents the schema for a configuration item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSchemaItem {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub input_type: ConfigSchemaType,
}

impl ConfigSchemaItem {
    pub fn new<S: Into<String>>(
        id: S,
        title: S,
        description: Option<S>,
        input_type: ConfigSchemaType,
    ) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            description: description.map(|d| d.into()),
            input_type,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents a configuration item, which includes an identifier and its corresponding value.
pub struct ConfigItem {
    pub id: String,
    pub value: ConfigValue,
}

impl ConfigItem {
    pub fn new(id: impl Into<String>, value: ConfigValue) -> Self {
        Self {
            id: id.into(),
            value,
        }
    }
}

/// Represents the value of a configuration item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConfigValue {
    Boolean(bool),
    Number(i64),
    Float(f64),
    Text(String),
    /// A string representing a file or directory path.
    Path(PathBuf),
    /// A string representing a selected option from a drop-down menu
    Dropdown(String),
}
