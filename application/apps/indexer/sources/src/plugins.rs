use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginParserSettings {
    pub plugin_path: PathBuf,
    pub general_settings: PluginParserGeneralSetttings,
    pub plugin_configs: Vec<ConfigItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
/// General settings for all parsers as plugins
pub struct PluginParserGeneralSetttings {
    pub placeholder: String,
}

impl PluginParserSettings {
    /// Implementation needed during prototyping only
    pub fn prototyping(plugin_path: PathBuf, plugin_configs: Vec<ConfigItem>) -> Self {
        Self {
            plugin_path,
            general_settings: PluginParserGeneralSetttings {
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
    pub source_input: ByteSourceInput,
    pub general_settings: PluginByteSourceGeneralSettings,
    pub custom_config_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
/// Represents The input source for byte source to read from
pub enum ByteSourceInput {
    /// File input source with its path
    File(PathBuf),
    /// Socket Connection, identified with IP address and port
    Socket { ip: String, port: u16 },
    /// Network source identified with URL
    Url(String),
    /// Connection String for a Database
    DbConnectionString(String),
    /// In-Memory bytes buffer
    Memory(Vec<u8>),
    /// Other types of input sources can be added here.
    Other(String),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
/// General settings for all parsers as plugins
pub struct PluginByteSourceGeneralSettings {
    pub placeholder: String,
}

impl PluginByteSourceSettings {
    /// Implementation needed during prototyping only
    pub fn prototyping(plugin_path: PathBuf, source_input: ByteSourceInput) -> Self {
        Self {
            plugin_path,
            source_input,
            general_settings: PluginByteSourceGeneralSettings {
                placeholder: Default::default(),
            },
            custom_config_path: None,
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
