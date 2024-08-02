use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginParserSettings {
    pub plugin_path: PathBuf,
    pub general_settings: PluginParserGeneralSetttings,
    pub custom_config_path: Option<PathBuf>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
/// General settings for all parsers as plugins
pub struct PluginParserGeneralSetttings {
    pub placeholder: String,
}

impl PluginParserSettings {
    /// Implementation needed during prototyping only
    pub fn prototyping(plugin_path: PathBuf) -> Self {
        Self {
            plugin_path,
            general_settings: PluginParserGeneralSetttings {
                placeholder: Default::default(),
            },
            custom_config_path: None,
        }
    }

    /// Default implementation needed during prototyping only
    pub fn default_prototyping() -> Self {
        Self::prototyping(PathBuf::default())
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
