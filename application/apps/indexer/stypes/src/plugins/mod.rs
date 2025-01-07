#[cfg(feature = "rustcore")]
mod extending;
#[cfg(feature = "nodejs")]
mod nodejs;
#[cfg(test)]
mod proptest;

use crate::*;

//TODO AAZ: Remove if still not used.
#[allow(unused)]
#[cfg(feature = "rustcore")]
pub use extending::*;

/// Settings for the Plugins parser.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginParserSettings {
    pub plugin_path: PathBuf,
    //Check if Default implementation should be removed on General Setting once this temp is done.
    //TODO AAZ: Temp solution.
    #[cfg_attr(feature = "rustcore", serde(default))]
    pub general_settings: PluginParserGeneralSettings,
    pub plugin_configs: Vec<PluginConfigItem>,
}

/// General settings for all parsers as plugins
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
//TODO AAZ: Check if this is needed in the final solution
pub struct PluginParserGeneralSettings {
    pub placeholder: String,
}

/// Settings for the Plugin Byte-Sources.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginByteSourceSettings {
    pub plugin_path: PathBuf,
    pub general_settings: PluginByteSourceGeneralSettings,
    pub plugin_configs: Vec<PluginConfigItem>,
}

//TODO AAZ: Make sure this is needed
/// General settings for all byte-sources as plugins
#[derive(Debug, Serialize, Deserialize, Clone)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginByteSourceGeneralSettings {
    pub placeholder: String,
}

/// Represents a configuration item, which includes an identifier and its corresponding value.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginConfigItem {
    pub id: String,
    pub value: PluginConfigValue,
}

/// Represents the value of a configuration item.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub enum PluginConfigValue {
    Boolean(bool),
    Number(i64),
    Float(f64),
    Text(String),
    /// A string representing a file or directory path.
    Path(PathBuf),
    /// A string representing a selected option from a drop-down menu
    Dropdown(String),
}

/// Defines the possible input types for configuration schemas.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub enum PluginConfigSchemaType {
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
#[extend::encode_decode]
#[cfg_attr(
    all(test, feature = "test_and_gen"),
    derive(TS),
    ts(export, export_to = "plugins.ts")
)]
pub struct PluginConfigSchemaItem {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub input_type: PluginConfigSchemaType,
}
